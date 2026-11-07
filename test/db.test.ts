import { describe, expect, it } from "vitest";
import { demoDb, deviceDb, profileDb } from "../src/lib/db";

function measurement(over: Record<string, unknown> = {}) {
  return {
    client_id: "11111111-2222-4333-8444-000000000001",
    crew_id: "db-crew",
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
    ...over,
  };
}

describe("databases", () => {
  it("creates profile, device and demo stores with indexes", async () => {
    const profile = await profileDb("db-crew");
    await profile.put("measurements", measurement() as never);
    const byMetric = await profile.getAllFromIndex(
      "measurements",
      "by-metric-time",
      IDBKeyRange.bound(["heart_rate", ""], ["heart_rate", "z"])
    );
    expect(byMetric).toHaveLength(1);

    const demo = await demoDb();
    await demo.put("measurements", measurement({ crew_id: "demo" }) as never);
    expect(await demo.getAll("measurements")).toHaveLength(1);

    const device = await deviceDb();
    await device.put("outbox", {
      client_id: "22222222-3333-4444-8555-000000000002",
      crew_id: "db-crew",
      kind: "measurement",
      payload: measurement(),
      state: "queued",
      attempts: 0,
      error: null,
      created_at: "2026-11-08T10:00:00Z",
    } as never);
    expect(await device.getAllFromIndex("outbox", "by-state", "queued")).toHaveLength(1);
    expect(await device.get("settings", "missing")).toBeUndefined();
  });
});
