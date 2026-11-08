import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceDb } from "../src/lib/db";
import {
  OUTBOX_MAX_MS,
  computeBackoffMs,
  enqueue,
  flush,
  pendingEmergencyCount,
} from "../src/lib/outbox";

afterEach(async () => {
  vi.unstubAllGlobals();
  const db = await deviceDb();
  await db.clear("outbox");
  await db.clear("settings");
  await db.clear("profiles");
});

function measurement(client_id: string, crew_id: string) {
  return {
    client_id,
    crew_id,
    metric: "heart_rate",
    value_num: 72,
    value_text: null,
    unit: "bpm",
    measured_at: "2026-11-08T10:00:00Z",
    received_at: "",
    source: "manual",
    device_id: "device-1",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
    phase_day: 21,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
  };
}

function report(client_id: string, kind: "emergency" | "routine", submitted_by: string) {
  return {
    client_id,
    device_id: "device-1",
    submitted_by,
    subject_crew_id: null,
    subject_label: "unknown crewmate",
    kind,
    created_at: "2026-11-08T11:00:00Z",
    received_at: "",
    payload_json: "{}",
    summary_text: null,
    summary_edited: 0,
    status: "delivered",
    acknowledged_by: null,
    acknowledged_at: null,
  };
}

async function seedSession(crewId: string, token: string): Promise<void> {
  const db = await deviceDb();
  await db.put("profiles", {
    crew_id: crewId,
    display_name: crewId,
    token,
    role: "astronaut",
    expires_at: "2030-01-01T00:00:00Z",
    provenance: "real",
    device_id: "device-1",
    pin_hash: null,
    shared_device: false,
  });
}

describe("outbox backoff", () => {
  it("doubles from 5s, caps at 10min, jitters ±20%", () => {
    expect(computeBackoffMs(0, () => 0.5)).toBe(5000);
    expect(computeBackoffMs(1, () => 0.5)).toBe(10000);
    expect(computeBackoffMs(100, () => 0.5)).toBe(OUTBOX_MAX_MS);
    const low = computeBackoffMs(0, () => 0);
    const high = computeBackoffMs(0, () => 1);
    expect(low).toBe(4000);
    expect(high).toBe(6000);
  });
});

describe("outbox flush", () => {
  it("delivers batches and clears them", async () => {
    await seedSession("flush-crew", "tok-flush");
    await enqueue({ client_id: "m-1", crew_id: "flush-crew", kind: "measurement", payload: measurement("m-1", "flush-crew") as never });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ accepted: ["m-1"], duplicates: [], rejected: [], max_items: 100 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await flush();
    expect(outcome.sent).toBe(1);
    expect(outcome.failed).toBe(0);
    const db = await deviceDb();
    expect(await db.getAll("outbox")).toHaveLength(0);
  });

  it("keeps failed sends queued with backoff and marks rejects failed", async () => {
    await seedSession("retry-crew", "tok-retry");
    await enqueue({ client_id: "m-2", crew_id: "retry-crew", kind: "measurement", payload: measurement("m-2", "retry-crew") as never });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    const outcome = await flush(1_000_000);
    expect(outcome.sent).toBe(0);
    expect(outcome.nextRetryAt).toBeGreaterThan(1_000_000);
    const db = await deviceDb();
    const kept = await db.get("outbox", "m-2");
    expect(kept?.state).toBe("queued");
    expect(kept?.attempts).toBe(1);
  });

  it("sends an emergency report under the next session", async () => {
    await seedSession("later-crew", "tok-later");
    await enqueue({
      client_id: "e-1",
      crew_id: "nobody",
      kind: "report",
      payload: report("e-1", "emergency", "nobody") as never,
    });
    expect(await pendingEmergencyCount()).toBe(1);
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        seen.push(new Headers(init.headers).get("Authorization") ?? "");
        return new Response(JSON.stringify({ report: {}, duplicate: false }), { status: 201 });
      })
    );
    const outcome = await flush();
    expect(outcome.sent).toBe(1);
    expect(seen).toEqual(["Bearer tok-later"]);
    expect(await pendingEmergencyCount()).toBe(0);
  });
});
