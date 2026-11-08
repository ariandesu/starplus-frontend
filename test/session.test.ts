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
});
