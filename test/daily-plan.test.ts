import { describe, expect, it } from "vitest";
import { buildDailyPlan, finishOutcome } from "../src/lib/daily-plan";
import type { Measurement, Result } from "@starplus/core";

type Overrides = Partial<Measurement>;

function reading(metric: string, measuredAt: string, overrides: Overrides = {}): Measurement {
  return {
    client_id: `${metric}-${measuredAt}`,
    crew_id: "crew-1",
    metric,
    value_num: 60,
    value_text: null,
    unit: "",
    measured_at: measuredAt,
    received_at: measuredAt,
    source: "manual",
    device_id: "device-1",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
    phase_day: null,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
    ...overrides,
  };
}

function result(per: { metric: string; status: string }[]): Result {
  return {
    client_id: "result-1",
    crew_id: "crew-1",
    assessed_at: "2026-11-12T06:00:00.000Z",
    overall_status: "watch",
    per_measure: per.map((p) => ({
      metric: p.metric,
      status: p.status as never,
      status_source: "safety_limit" as const,
      reason_code: "within_limits" as const,
      values: {
        value: 1,
        unit: "",
        client_id: "x",
        baseline_mean: null,
        baseline_n: 0,
        window_mean: null,
        z_score: null,
        trend: null,
        confirm_required: false,
        refuted: [],
      },
    })),
    model_advice: null,
    model_id: "m",
    model_version: "1",
    catalog_version: "1",
    kb_version: "1",
  } as unknown as Result;
}

const NOON = Date.parse("2026-11-12T12:00:00.000Z");

describe("buildDailyPlan", () => {
  it("gives 0 of 11 with an empty history", () => {
    const plan = buildDailyPlan([], null, { timeZone: "UTC", now: NOON });
    expect(plan.total).toBe(11);
    expect(plan.done).toBe(0);
    expect(plan.steps.map((s) => s.key)).toEqual([
      "heart_rate",
      "blood_pressure",
      "oxygen_saturation",
      "temperature_c",
      "respiratory_rate",
      "sleep_hours",
      "water_intake",
      "mood_score",
      "cabin_co2",
      "cabin_o2",
      "cabin_temperature",
    ]);
  });

  it("counts the blood-pressure pair as one step", () => {
    const plan = buildDailyPlan(
      [reading("blood_pressure_systolic", "2026-11-12T08:00:00.000Z")],
      null,
      { timeZone: "UTC", now: NOON }
    );
    expect(plan.total).toBe(11);
    expect(plan.done).toBe(1);
    expect(plan.steps.find((s) => s.key === "blood_pressure")?.done).toBe(true);
  });

  it("adds a watch measure that is not one of the eleven", () => {
    const plan = buildDailyPlan([], result([{ metric: "blood_glucose", status: "watch" }]), {
      timeZone: "UTC",
      now: NOON,
    });
    expect(plan.total).toBe(12);
    const extra = plan.steps[11];
    expect(extra.key).toBe("blood_glucose");
    expect(extra.label).toBe("Blood glucose");
  });

  it("does not add a watch measure that is already a step", () => {
    const plan = buildDailyPlan([], result([{ metric: "heart_rate", status: "critical" }]), {
      timeZone: "UTC",
      now: NOON,
    });
    expect(plan.total).toBe(11);
  });

  it("ignores yesterday's reading", () => {
    const plan = buildDailyPlan([reading("heart_rate", "2026-11-11T23:00:00.000Z")], null, {
      timeZone: "UTC",
      now: NOON,
    });
    expect(plan.done).toBe(0);
  });

  it("uses the device time zone for the day boundary", () => {
    // 23:30 UTC on the 11th is 05:30 on the 12th in Dhaka.
    const late = [reading("heart_rate", "2026-11-11T23:30:00.000Z")];
    expect(buildDailyPlan(late, null, { timeZone: "UTC", now: NOON }).done).toBe(0);
    expect(buildDailyPlan(late, null, { timeZone: "Asia/Dhaka", now: NOON }).done).toBe(1);
  });

  it("counts only this device's synthetic readings in a demo session", () => {
    const seeded = [
      reading("heart_rate", "2026-11-12T08:00:00.000Z", { provenance: "synthetic", device_id: "seed" }),
    ];
    expect(buildDailyPlan(seeded, null, { timeZone: "UTC", now: NOON, demo: true, deviceId: "device-1" }).done).toBe(0);
    expect(buildDailyPlan(seeded, null, { timeZone: "UTC", now: NOON, demo: true, deviceId: "seed" }).done).toBe(1);
    expect(buildDailyPlan(seeded, null, { timeZone: "UTC", now: NOON, demo: false }).done).toBe(0);
  });

  it("counts a real reading from any device, demo or not", () => {
    const real = [reading("heart_rate", "2026-11-12T08:00:00.000Z", { device_id: "phone" })];
    expect(buildDailyPlan(real, null, { timeZone: "UTC", now: NOON, demo: true, deviceId: "device-1" }).done).toBe(1);
  });

  it("counts real readings from any device outside demo", () => {
    const other = [reading("heart_rate", "2026-11-12T08:00:00.000Z", { device_id: "phone" })];
    expect(buildDailyPlan(other, null, { timeZone: "UTC", now: NOON, demo: false, deviceId: "device-1" }).done).toBe(1);
  });

  it("ignores synthetic and voided readings", () => {
    const plan = buildDailyPlan(
      [
        reading("heart_rate", "2026-11-12T08:00:00.000Z", { provenance: "synthetic" }),
        reading("sleep_hours", "2026-11-12T08:00:00.000Z", { voided: 1 }),
      ],
      null,
      { timeZone: "UTC", now: NOON }
    );
    expect(plan.done).toBe(0);
  });
});

describe("finishOutcome", () => {
  const latest = result([{ metric: "heart_rate", status: "nominal" }]);

  it("assesses after at least one reading", () => {
    expect(finishOutcome(1, latest)).toEqual({ assess: true, resultId: null });
  });

  it("does not assess with nothing recorded, and points at the latest result", () => {
    expect(finishOutcome(0, latest)).toEqual({ assess: false, resultId: "result-1" });
  });

  it("has no link when there is no earlier result", () => {
    expect(finishOutcome(0, null)).toEqual({ assess: false, resultId: null });
  });
});
