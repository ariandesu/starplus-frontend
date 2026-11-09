import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDb, profileDb } from "../src/lib/db";
import { checkPin, DemoBusyError, getSession, isSharedDevice, login, loginDemo, logout, pullHistory, setPin, setSharedDevice } from "../src/lib/session";

afterEach(async () => {
  vi.unstubAllGlobals();
  const db = await deviceDb();
  await db.clear("settings");
  await db.clear("profiles");
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("session", () => {
  it("stores the PIN and checks it", async () => {
    await setPin("pin-crew", "1234");
    expect(await checkPin("pin-crew", "1234")).toBe(true);
    expect(await checkPin("pin-crew", "0000")).toBe(false);
    expect(await checkPin("unknown-crew", "1234")).toBe(false);
    await expect(setPin("pin-crew", "12")).rejects.toThrow();
  });

  it("logs in with a code and expires the session", async () => {
    const fetchMock = vi.fn(async () =>
      ok({ token: "tok-1", crew_id: "sess-crew", role: "astronaut", expires_at: "2030-01-01T00:00:00Z", provenance: "real" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const session = await login("ABCDEFGH");
    expect(session.crew_id).toBe("sess-crew");
    expect(await getSession("sess-crew")).toMatchObject({ token: "tok-1", provenance: "real" });

    const db = await deviceDb();
    const profile = await db.get("profiles", "sess-crew");
    await db.put("profiles", { ...profile!, expires_at: "2020-01-01T00:00:00Z" });
    expect(await getSession("sess-crew")).toBeNull();

    await logout("sess-crew");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when the code is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(login("ZZZZZZZZ")).rejects.toThrow("That code did not work");
  });

  it("tells a wrong code from a rate limit from a server error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(login("BADCODE1")).rejects.toThrow("That code did not work");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow", { status: 429 })));
    await expect(login("BADCODE2")).rejects.toThrow("Too many tries");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    await expect(login("BADCODE3")).rejects.toThrow("Something went wrong");
  });

  it("says the code was not used when the server cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    await expect(login("VALIDCD1")).rejects.toThrow("Your code has not been used");
  });

  it("says the session was not saved when the device write fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json{", { status: 200 })));
    await expect(login("VALIDCD2")).rejects.toThrow("could not save the session");
  });

  it("sends shared:true when the device is marked shared", async () => {
    const seen: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        seen.push(JSON.parse(init.body as string));
        return ok({ token: "tok-shared", crew_id: "shared-crew", role: "astronaut", expires_at: "2030-01-01T00:00:00Z" });
      })
    );
    await setSharedDevice(true);
    expect(await isSharedDevice()).toBe(true);
    await login("SHAREDCD");
    expect(seen).toEqual([
      expect.objectContaining({ code: "SHAREDCD", shared: true }),
    ]);
    await setSharedDevice(false);
    await login("NORMALCD");
    expect(seen[1]).toEqual(expect.not.objectContaining({ shared: true }));
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

  it("clears an expired stored crew and returns none", async () => {
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
    expect(await getActiveCrewId(null)).toBeNull();
    expect((await db.get("settings", "active_crew"))?.value).toBe("");
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

  it("logs in to the demo crew and marks the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({ token: "tok-demo", crew_id: "demo-astronaut", role: "astronaut", expires_at: "2030-01-01T00:00:00Z", provenance: "synthetic", demo: true })
      )
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
