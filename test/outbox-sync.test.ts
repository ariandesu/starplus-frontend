import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDb } from "../src/lib/db";
import { enqueue, flush, outboxStatus } from "../src/lib/outbox";
import {
  cancelScheduledSync,
  requestOutboxSync,
  rescheduleSync,
  startOutboxSync,
} from "../src/lib/outbox-sync";

function okBatch(accepted: string[]) {
  return new Response(JSON.stringify({ accepted, duplicates: [], rejected: [], max_items: 100 }), {
    status: 200,
  });
}

async function seedSession(crewId = "sync-crew"): Promise<void> {
  const db = await deviceDb();
  await db.put("profiles", {
    crew_id: crewId,
    display_name: crewId,
    token: "tok-sync",
    role: "astronaut",
    expires_at: "2030-01-01T00:00:00Z",
    provenance: "real",
    device_id: "device-1",
    pin_hash: null,
    shared_device: false,
  });
}

async function seedQueued(clientId = "m-sync", crewId = "sync-crew"): Promise<void> {
  await enqueue({ client_id: clientId, crew_id: crewId, kind: "measurement", payload: { client_id: clientId } as never });
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cancelScheduledSync();
  const db = await deviceDb();
  await db.clear("outbox");
  await db.clear("settings");
  await db.clear("profiles");
});

describe("outbox auto-sync", () => {
  it("syncs on app open when a session exists", async () => {
    await seedSession();
    await seedQueued();
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startOutboxSync();
    try {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    } finally {
      stop();
    }
  });

  it("does not sync on app open without a session", async () => {
    await seedQueued();
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startOutboxSync();
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  it("syncs right after login", async () => {
    await seedSession();
    await seedQueued();
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    await requestOutboxSync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("syncs on the online event", async () => {
    await seedSession();
    const fetchMock = vi.fn(async () => okBatch(["m-on"]));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startOutboxSync();
    try {
      const db = await deviceDb();
      await db.put("outbox", {
        client_id: "m-on",
        crew_id: "sync-crew",
        kind: "measurement",
        payload: {
          client_id: "m-on",
          crew_id: "sync-crew",
          metric: "heart_rate",
          value_num: 72,
        } as never,
        state: "queued",
        attempts: 0,
        error: null,
        created_at: new Date().toISOString(),
      });
      expect(fetchMock).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("online"));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    } finally {
      stop();
    }
  });

  it("syncs after something is queued", async () => {
    await seedSession();
    const fetchMock = vi.fn(async () => okBatch(["m-q"]));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startOutboxSync();
    try {
      await seedQueued("m-q");
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    } finally {
      stop();
    }
  });

  it("retries on the backoff timer while items wait", async () => {
    await seedSession();
    await seedQueued();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        throw new TypeError("offline");
      })
    );
    const stop = startOutboxSync();
    try {
      await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(1));
      const db = await deviceDb();
      await db.put("settings", { key: "outbox_next_retry_at", value: String(Date.now() + 50) });
      const before = calls;
      await rescheduleSync();
      await vi.waitFor(() => expect(calls).toBeGreaterThan(before), { timeout: 2000 });
    } finally {
      stop();
    }
  });

  it("forced send ignores and clears the backoff", async () => {
    await seedSession();
    await seedQueued();
    const db = await deviceDb();
    await db.put("settings", { key: "outbox_failures", value: "3" });
    await db.put("settings", { key: "outbox_next_retry_at", value: String(Date.now() + 600_000) });
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await requestOutboxSync({ force: true });
    expect(outcome.sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.get("settings", "outbox_next_retry_at")).toBeUndefined();
    expect((await db.get("settings", "outbox_failures"))?.value).toBe("0");
  });

  it("automatic triggers skip while offline and record no failure", async () => {
    await seedSession();
    await seedQueued();
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    const online = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    try {
      const outcome = await requestOutboxSync();
      expect(outcome.sent).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
      const db = await deviceDb();
      expect(await db.get("settings", "outbox_failures")).toBeUndefined();
      expect(await db.get("settings", "outbox_next_retry_at")).toBeUndefined();
    } finally {
      Object.defineProperty(window.navigator, "onLine", { value: online, configurable: true });
    }
  });

  it("consecutive failures double the backoff and any success resets it", async () => {
    await seedSession();
    const db = await deviceDb();
    const failFetch = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", failFetch);
    await seedQueued("m-f1");
    const first = await requestOutboxSync().catch(() => ({ sent: 0, failed: 0, nextRetryAt: null }));
    void first;
    const failuresAfterOne = (await db.get("settings", "outbox_failures"))?.value;
    expect(failuresAfterOne).toBe("1");
    const retryAfterOne = Number((await db.get("settings", "outbox_next_retry_at"))?.value ?? "0");
    const firstDelay = retryAfterOne - Date.now();
    expect(firstDelay).toBeGreaterThanOrEqual(4000);
    expect(firstDelay).toBeLessThanOrEqual(6000);

    await db.put("outbox", {
      client_id: "m-f2",
      crew_id: "sync-crew",
      kind: "measurement",
      payload: { client_id: "m-f2" } as never,
      state: "queued",
      attempts: 0,
      error: null,
      created_at: new Date().toISOString(),
    });
    await db.delete("settings", "outbox_next_retry_at");
    await requestOutboxSync().catch(() => undefined);
    expect((await db.get("settings", "outbox_failures"))?.value).toBe("2");
    const retryAfterTwo = Number((await db.get("settings", "outbox_next_retry_at"))?.value ?? "0");
    const secondDelay = retryAfterTwo - Date.now();
    expect(secondDelay).toBeGreaterThanOrEqual(8000);
    expect(secondDelay).toBeLessThanOrEqual(12000);

    vi.stubGlobal("fetch", vi.fn(async () => okBatch(["m-f2"])));
    await db.delete("settings", "outbox_next_retry_at");
    const outcome = await requestOutboxSync({ force: true });
    expect(outcome.sent).toBe(1);
    expect((await db.get("settings", "outbox_failures"))?.value).toBe("0");
    expect(await db.get("settings", "outbox_next_retry_at")).toBeUndefined();
  });

  it("queues during a send run one more send afterwards", async () => {
    await seedSession();
    await seedQueued("m-d1");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        await gate;
        return okBatch([`m-d${calls}`]);
      })
    );
    const first = requestOutboxSync();
    await vi.waitFor(() => expect(calls).toBe(1));
    await seedQueued("m-d2");
    const second = requestOutboxSync();
    release();
    await first;
    await second;
    await vi.waitFor(() => expect(calls).toBeGreaterThanOrEqual(2), { timeout: 2000 });
    expect(await outboxStatus()).toMatchObject({ waiting: 0 });
  });

  it("never sends two batches at once", async () => {
    await seedSession();
    await seedQueued("m-a");
    await seedQueued("m-b");
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return okBatch([]);
      })
    );
    await Promise.all([requestOutboxSync(), requestOutboxSync(), requestOutboxSync()]);
    expect(maxInFlight).toBe(1);
  });

  it("does not send in demo mode", async () => {
    await seedSession();
    await seedQueued();
    const db = await deviceDb();
    await db.put("settings", { key: "demo_mode", value: "true" });
    const fetchMock = vi.fn(async () => okBatch(["m-sync"]));
    vi.stubGlobal("fetch", fetchMock);
    const stop = startOutboxSync();
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(fetchMock).not.toHaveBeenCalled();
      const outcome = await flush();
      expect(outcome.sent).toBe(0);
    } finally {
      stop();
    }
  });

  it("rescheduleSync is a no-op with nothing waiting", async () => {
    const fetchMock = vi.fn(async () => okBatch([]));
    vi.stubGlobal("fetch", fetchMock);
    await rescheduleSync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
