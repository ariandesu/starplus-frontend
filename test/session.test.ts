import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDb } from "../src/lib/db";
import { checkPin, getSession, login, logout, setPin } from "../src/lib/session";

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
      ok({ token: "tok-1", crew_id: "sess-crew", role: "astronaut", expires_at: "2030-01-01T00:00:00Z" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const session = await login("ABCDEFGH");
    expect(session.crew_id).toBe("sess-crew");
    expect(await getSession("sess-crew")).toMatchObject({ token: "tok-1" });

    const db = await deviceDb();
    const profile = await db.get("profiles", "sess-crew");
    await db.put("profiles", { ...profile!, expires_at: "2020-01-01T00:00:00Z" });
    expect(await getSession("sess-crew")).toBeNull();

    await logout("sess-crew");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when the code is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 401 })));
    await expect(login("ZZZZZZZZ")).rejects.toThrow();
  });
});
