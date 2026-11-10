// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDb, profileDb } from "../src/lib/db";
import {
  checkPin,
  DemoBusyError,
  getProfile,
  getSession,
  isSharedDevice,
  loginDemo,
  loginWithPassword,
  logout,
  pullHistory,
  redeemCode,
  refreshSession,
  setPin,
  setSharedDevice,
} from "../src/lib/session";
import { DEMO_CARDS, demoCardForKey, demoCardForUsername } from "../src/lib/demo-accounts";

afterEach(async () => {
  vi.unstubAllGlobals();
  const db = await deviceDb();
  await db.clear("settings");
  await db.clear("profiles");
});

function ok(body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

function sessionBody(over: { crew_id?: string; name?: string; role?: string; demo?: boolean; expiresAt?: string; username?: string } = {}) {
  return {
    user: {
      id: "user-1",
      name: over.name ?? "Alex Rivera",
      email: "alex@example.com",
      emailVerified: true,
      username: over.username ?? "astronaut01",
      crew_id: over.crew_id ?? "demo-astronaut",
      role: over.role ?? "astronaut",
      provenance: over.demo === false ? "real" : "synthetic",
      demo: over.demo ?? true,
    },
    session: { id: "session-1", expiresAt: over.expiresAt ?? "2030-01-01T00:00:00.000Z" },
  };
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function authHeader(init?: RequestInit): string {
  return new Headers(init?.headers).get("authorization") ?? "";
}

describe("demo cards", () => {
  it("maps the three cards to their usernames", () => {
    expect(DEMO_CARDS.map((card) => card.username)).toEqual(["astronaut01", "fmo01", "mc01"]);
    expect(demoCardForUsername("FMO01")?.role).toBe("flight_medical_officer");
    expect(demoCardForKey("surgeon")?.username).toBe("fmo01");
    expect(demoCardForKey("astronaut")?.crew_id).toBe("demo-astronaut");
    expect(demoCardForKey("mission")?.username).toBe("mc01");
  });
});

describe("session", () => {
  it("stores the PIN and checks it", async () => {
    await setPin("pin-crew", "1234");
    expect(await checkPin("pin-crew", "1234")).toBe(true);
    expect(await checkPin("pin-crew", "0000")).toBe(false);
    expect(await checkPin("unknown-crew", "1234")).toBe(false);
    await expect(setPin("pin-crew", "12")).rejects.toThrow();
  });

  it("redeems a code and stores the bearer token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.includes("/api/auth/redeem-code")) {
        return new Response(JSON.stringify({ token: "tok-1" }), { status: 201 });
      }
      if (url.includes("/api/auth/get-session")) {
        expect(authHeader(init)).toBe("Bearer tok-1");
        return ok(sessionBody({ crew_id: "sess-crew", demo: false, username: "new_member" }));
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const session = await redeemCode("ABCDEFGH", "new_member", "password-123");
    expect(session.crew_id).toBe("sess-crew");
    expect(await getSession("sess-crew")).toMatchObject({ token: "tok-1", provenance: "real", username: "new_member" });

    const db = await deviceDb();
    const profile = await db.get("profiles", "sess-crew");
    await db.put("profiles", { ...profile!, expires_at: "2020-01-01T00:00:00Z" });
    expect(await getSession("sess-crew")).toBeNull();

    await logout("sess-crew");
    expect(fetchMock.mock.calls.some((call) => urlOf(call[0]).includes("/sign-out"))).toBe(true);
  });

  it("maps redeem failures to friendly messages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(redeemCode("ZZZZZZZZ", "someone", "password-123")).rejects.toThrow("That code did not work");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(redeemCode("BADCODE1", "someone", "password-123")).rejects.toThrow("Too many tries");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    await expect(redeemCode("BADCODE2", "someone", "password-123")).rejects.toThrow("Something went wrong");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "That username is taken" }), { status: 409 })));
    await expect(redeemCode("TAKEN123", "someone", "password-123")).rejects.toThrow("username is taken");
  });

  it("says the code was not used when the server cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(redeemCode("VALIDCD1", "someone", "password-123")).rejects.toThrow("Your code has not been used");
  });

  it("sends the shared-device header on sign-in", async () => {
    const seen: Array<Record<string, string>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input);
        if (url.includes("/sign-in/username")) {
          seen.push(Object.fromEntries(new Headers(init?.headers).entries()));
          return ok({ user: sessionBody().user }, { "set-auth-token": "tok-shared" });
        }
        return ok(sessionBody());
      })
    );
    await setSharedDevice(true);
    expect(await isSharedDevice()).toBe(true);
    await loginWithPassword("astronaut01", "password-123");
    expect(seen.at(-1)?.["x-shared-device"]).toBe("1");

    await setSharedDevice(false);
    await loginWithPassword("astronaut01", "password-123");
    expect(seen.at(-1)?.["x-shared-device"]).toBeUndefined();
  });

  it("salts the PIN hash per device", async () => {
    await setPin("salt-crew", "1234");
    const db = await deviceDb();
    const salt = (await db.get("settings", "pin_salt"))?.value;
    expect(typeof salt).toBe("string");
    expect(salt!.length).toBeGreaterThan(0);
    const profile = await db.get("profiles", "salt-crew");
    expect(profile?.pin_hash).not.toContain("1234");
    expect(await checkPin("salt-crew", "1234")).toBe(true);
    expect(await checkPin("salt-crew", "0000")).toBe(false);
  });

  it("prefers the URL crew when its session is valid", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "url-crew",
      display_name: "url-crew",
      token: "tok-url",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "other-crew" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId("url-crew")).toBe("url-crew");
  });

  it("stores a valid URL crew as the active crew", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "url-store-crew",
      display_name: "url-store-crew",
      token: "tok-url-store",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "stale-crew" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId("url-store-crew")).toBe("url-store-crew");
    expect((await db.get("settings", "active_crew"))?.value).toBe("url-store-crew");
  });

  it("falls back to the stored crew when the URL crew has no session", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "stored-crew",
      display_name: "stored-crew",
      token: "tok-stored",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "stored-crew" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId("unknown-crew")).toBe("stored-crew");
    expect(await getActiveCrewId(null)).toBe("stored-crew");
  });

  it("keeps an expired stored crew so the expired view can name it", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "old-crew",
      display_name: "old-crew",
      token: "tok-old",
      role: "astronaut",
      expires_at: "2020-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "old-crew" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBe("old-crew");
    expect((await db.get("settings", "active_crew"))?.value).toBe("old-crew");
  });

  it("clears the active crew on logout", async () => {
    const { logout } = await import("../src/lib/session");
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "bye-crew",
      display_name: "bye-crew",
      token: "tok-bye",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "bye-crew" });
    await logout("bye-crew");
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBeNull();
  });

  it("touches last activity when the active crew is set", async () => {
    const { setActiveCrew, lastActivity } = await import("../src/lib/session");
    const before = Date.now();
    await setActiveCrew("touch-crew");
    const last = await lastActivity();
    expect(last).not.toBeNull();
    expect(Date.parse(last!)).toBeGreaterThanOrEqual(before);
  });

  it("ignores the stored crew on a shared device idle over 30 minutes", async () => {
    const db = await deviceDb();
    await db.put("settings", { key: "shared_device", value: "true" });
    await db.put("profiles", {
      crew_id: "idle-crew",
      display_name: "idle-crew",
      token: "tok-idle",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: true,
    });
    await db.put("settings", { key: "active_crew", value: "idle-crew" });
    await db.put("settings", { key: "last_active", value: new Date(Date.now() - 31 * 60 * 1000).toISOString() });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBeNull();
    expect((await db.get("settings", "active_crew"))?.value).toBe("");
  });

  it("keeps the stored crew on a shared device used recently", async () => {
    const db = await deviceDb();
    await db.put("settings", { key: "shared_device", value: "true" });
    await db.put("profiles", {
      crew_id: "fresh-crew",
      display_name: "fresh-crew",
      token: "tok-fresh",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: true,
    });
    await db.put("settings", { key: "active_crew", value: "fresh-crew" });
    await db.put("settings", { key: "last_active", value: new Date().toISOString() });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBe("fresh-crew");
  });

  it("keeps the stored crew on a personal device regardless of idle time", async () => {
    const db = await deviceDb();
    await db.put("settings", { key: "shared_device", value: "false" });
    await db.put("profiles", {
      crew_id: "personal-crew",
      display_name: "personal-crew",
      token: "tok-personal",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    await db.put("settings", { key: "active_crew", value: "personal-crew" });
    await db.put("settings", { key: "last_active", value: "2020-01-01T00:00:00Z" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBe("personal-crew");
  });

  it("locks the URL crew too on an idle shared device", async () => {
    const db = await deviceDb();
    await db.put("settings", { key: "shared_device", value: "true" });
    await db.put("profiles", {
      crew_id: "url-shared-crew",
      display_name: "url-shared-crew",
      token: "tok-url-shared",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: true,
    });
    await db.put("settings", { key: "active_crew", value: "other-crew" });
    await db.put("settings", { key: "last_active", value: "2020-01-01T00:00:00Z" });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId("url-shared-crew")).toBeNull();
    expect((await db.get("settings", "active_crew"))?.value).toBe("");
  });

  it("adopts a single stranded session and writes active_crew", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "stranded-crew",
      display_name: "Stranded Crew",
      token: "tok-stranded",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    const { getActiveCrewId, listAdoptableCrews } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBe("stranded-crew");
    expect((await db.get("settings", "active_crew"))?.value).toBe("stranded-crew");
    expect(await listAdoptableCrews()).toEqual([
      { crew_id: "stranded-crew", display_name: "Stranded Crew", role: "astronaut" },
    ]);
  });

  it("returns choose for several stranded sessions and ignores expired ones", async () => {
    const db = await deviceDb();
    for (const [id, expires] of [["crew-a", "2030-01-01T00:00:00Z"], ["crew-b", "2031-01-01T00:00:00Z"], ["crew-old", "2020-01-01T00:00:00Z"]] as const) {
      await db.put("profiles", {
        crew_id: id,
        display_name: id,
        token: `tok-${id}`,
        role: "astronaut",
        expires_at: expires,
        provenance: "real",
        device_id: "d",
        pin_hash: null,
        shared_device: false,
      });
    }
    const { getActiveCrewId, listAdoptableCrews } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBe("choose");
    expect((await db.get("settings", "active_crew"))?.value ?? "").toBe("");
    expect((await listAdoptableCrews()).map((profile) => profile.crew_id)).toEqual(["crew-b", "crew-a"]);
  });

  it("stays locked on a shared device past the idle limit even with stranded sessions", async () => {
    const db = await deviceDb();
    await db.put("settings", { key: "shared_device", value: "true" });
    await db.put("settings", { key: "last_active", value: "2020-01-01T00:00:00Z" });
    await db.put("profiles", {
      crew_id: "idle-stranded",
      display_name: "Idle Stranded",
      token: "tok-idle-stranded",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: true,
    });
    const { getActiveCrewId } = await import("../src/lib/session");
    expect(await getActiveCrewId(null)).toBeNull();
  });

  it("signs in to a demo role and marks the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = urlOf(input);
        if (url.includes("/sign-in/username")) {
          return ok({ user: sessionBody().user }, { "set-auth-token": "tok-demo" });
        }
        return ok(sessionBody());
      })
    );
    const session = await loginDemo("astronaut");
    expect(session).toMatchObject({ crew_id: "demo-astronaut", demo: true });
    expect(await getSession("demo-astronaut")).toMatchObject({ token: "tok-demo", demo: true });
  });

  it("turns a demo 429 into a retryable busy error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429, headers: { "Retry-After": "2" } }))
    );
    const busy = await loginDemo("astronaut").catch((error: unknown) => error);
    expect(busy).toBeInstanceOf(DemoBusyError);
    expect((busy as DemoBusyError).retryAfterMs).toBe(2000);
    expect((busy as Error).message).toContain("Retrying");
  });

  it("defaults the demo retry wait to 5 s without a Retry-After header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    const busy = await loginDemo("astronaut").catch((error: unknown) => error);
    expect(busy).toBeInstanceOf(DemoBusyError);
    expect((busy as DemoBusyError).retryAfterMs).toBe(5000);
  });

  it("silently re-signs an expired demo session in", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "demo-astronaut",
      display_name: "Alex Rivera",
      token: "tok-expired",
      role: "astronaut",
      expires_at: "2020-01-01T00:00:00Z",
      provenance: "synthetic",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
      demo: true,
      username: "astronaut01",
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.includes("/sign-in/username")) {
        return ok({ user: sessionBody().user }, { "set-auth-token": "tok-renewed" });
      }
      if (url.includes("/api/sync")) {
        return ok({ measurements: [], results: [], reports: [], reports_status: [], measurements_cursor: null, results_cursor: null });
      }
      if (authHeader(init) === "Bearer tok-expired") return ok(null);
      return ok(sessionBody());
    });
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await refreshSession("demo-astronaut");
    expect(outcome.status).toBe("active");
    if (outcome.status === "active") expect(outcome.session.token).toBe("tok-renewed");
    expect((await getProfile("demo-astronaut"))?.token).toBe("tok-renewed");
    expect(fetchMock.mock.calls.some((call) => urlOf(call[0]).includes("/sign-in/username"))).toBe(true);
  });

  it("reports a real expired session without signing in again", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "real-crew",
      display_name: "Real Crew",
      token: "tok-real-expired",
      role: "astronaut",
      expires_at: "2020-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
      demo: false,
      username: "real_member",
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ok(null));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await refreshSession("real-crew");
    expect(outcome).toEqual({
      status: "expired",
      crew_id: "real-crew",
      name: "Real Crew",
      username: "real_member",
      demo: false,
    });
    expect(fetchMock.mock.calls.some((call) => urlOf(call[0]).includes("/sign-in/username"))).toBe(false);
  });

  it("uses the stored session offline until it expires", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "offline-crew",
      display_name: "Offline Crew",
      token: "tok-offline",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const fetchMock = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const outcome = await refreshSession("offline-crew");
      expect(outcome.status).toBe("active");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    }
  });

  it("renews a live session and stores the slid expiry", async () => {
    const db = await deviceDb();
    await db.put("profiles", {
      crew_id: "renew-crew",
      display_name: "Renew Crew",
      token: "tok-renew",
      role: "astronaut",
      expires_at: "2030-01-01T00:00:00Z",
      provenance: "real",
      device_id: "d",
      pin_hash: null,
      shared_device: false,
    });
    vi.stubGlobal("fetch", vi.fn(async () => ok(sessionBody({ crew_id: "renew-crew", demo: false, expiresAt: "2031-02-02T00:00:00.000Z" }))));
    const outcome = await refreshSession("renew-crew");
    expect(outcome.status).toBe("active");
    expect((await getProfile("renew-crew"))?.expires_at).toBe("2031-02-02T00:00:00.000Z");
  });

  it("pulls history pages with per-table cursors", async () => {
    const seen: string[] = [];
    const measurement = (id: string) => ({
      client_id: id,
      crew_id: "pull-crew",
      metric: "heart_rate",
      value_num: 70,
      value_text: null,
      unit: "bpm",
      measured_at: "2026-11-08T10:00:00Z",
      received_at: "",
      source: "manual",
      device_id: "d",
      capture_id: null,
      is_estimate: 0,
      confirmed_by_user: 0,
      provenance: "synthetic",
      setting: "iss",
      phase: "inflight",
      phase_day: null,
      supersedes_client_id: null,
      voided: 0,
      catalog_version: "1",
      schema_version: 1,
    });
    const result = (id: string) => ({
      client_id: id,
      crew_id: "pull-crew",
      assessed_at: "2026-11-08T10:05:00Z",
      overall_status: "nominal",
      per_measure_json: "[]",
      model_advice_json: null,
      model_id: "none",
      model_version: "none",
      catalog_version: "1",
      kb_version: "none",
      inputs_hash: "abc",
      received_at: "",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(url);
        if (url.includes("since_measurements=c1")) {
          return ok({ measurements: [measurement("m-2")], results: [result("r-1")], reports_status: [], cursor: "c2", measurements_cursor: null, results_cursor: null });
        }
        return ok({ measurements: [measurement("m-1")], results: [], reports_status: [], cursor: "c1", measurements_cursor: "c1", results_cursor: null });
      })
    );
    await pullHistory("pull-crew", "tok-pull");
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain("since_measurements=c1");
    const db = await profileDb("pull-crew");
    expect(await db.get("measurements", "m-1")).toBeDefined();
    expect(await db.get("measurements", "m-2")).toBeDefined();
    const stored = await db.get("results", "r-1");
    expect(stored?.per_measure).toEqual([]);
    expect(stored?.model_advice).toBeNull();
    await db.clear("measurements");
    await db.clear("results");
  });

  it("stores the crew's own reports from the sync as delivered", async () => {
    const report = (id: string, kind: string) => ({
      client_id: id,
      device_id: "seed-demo",
      submitted_by: "pull-crew",
      subject_crew_id: null,
      subject_label: "unknown crewmate",
      kind,
      created_at: "2026-11-08T10:00:00Z",
      received_at: "2026-11-08T10:00:01Z",
      payload_json: "{}",
      summary_text: null,
      summary_edited: 0,
      status: "delivered",
      acknowledged_by: null,
      acknowledged_at: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ measurements: [], results: [], reports_status: [], reports: [report("rep-1", "routine"), report("rep-2", "emergency")], cursor: null, measurements_cursor: null, results_cursor: null }))
    );
    await pullHistory("pull-crew", "tok-pull");
    const db = await profileDb("pull-crew");
    expect(await db.get("reports", "rep-1")).toMatchObject({ kind: "routine", status: "delivered" });
    expect(await db.get("reports", "rep-2")).toMatchObject({ kind: "emergency", status: "delivered" });
    await db.clear("reports");
  });
});
