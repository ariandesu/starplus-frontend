import { describe, expect, it } from "vitest";
import { computeXp, eligibleForXp, xpGain, type XpSummary } from "../src/lib/xp";
import type { Measurement, Result } from "@starplus/core";

type Overrides = Partial<Measurement>;

function reading(metric: string, measuredAt: string, overrides: Overrides = {}): Measurement {
  return {
    client_id: `${metric}-${measuredAt}-${Math.random().toString(36).slice(2)}`,
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

const DAY = "2026-11-12T12:00:00.000Z";
const YESTERDAY = "2026-11-11T12:00:00.000Z";
const OPTS = { timeZone: "UTC", now: Date.parse(DAY) };

const EIGHT: [string, string][] = [
  ["heart_rate", DAY],
  ["blood_pressure_systolic", DAY],
  ["oxygen_saturation", DAY],
  ["temperature_c", DAY],
  ["respiratory_rate", DAY],
  ["sleep_hours", DAY],
  ["water_intake", DAY],
  ["mood_score", DAY],
];

function summary(total: number, level = 1, rank = "Cadet", fullCheckToday = false): XpSummary {
  return { total, today: total, level, rank, levelFloor: 0, nextLevelAt: 100, fullCheckToday };
}

describe("computeXp", () => {
  it("gives 0 XP, Level 1, Cadet on an empty history", () => {
    const xp = computeXp([], null, OPTS);
    expect(xp.total).toBe(0);
    expect(xp.today).toBe(0);
    expect(xp.level).toBe(1);
    expect(xp.rank).toBe("Cadet");
    expect(xp.levelFloor).toBe(0);
    expect(xp.nextLevelAt).toBe(100);
    expect(xp.fullCheckToday).toBe(false);
  });

  it("gives 10 for one heart-rate reading today", () => {
    const xp = computeXp([reading("heart_rate", DAY)], null, OPTS);
    expect(xp.total).toBe(10);
    expect(xp.today).toBe(10);
  });

  it("gives 10, not 20, for a blood-pressure pair", () => {
    const xp = computeXp(
      [reading("blood_pressure_systolic", DAY), reading("blood_pressure_diastolic", DAY)],
      null,
      OPTS
    );
    expect(xp.total).toBe(10);
  });

  it("gives 10 for the same metric twice in a day", () => {
    const xp = computeXp([reading("heart_rate", DAY), reading("heart_rate", "2026-11-12T18:00:00.000Z")], null, OPTS);
    expect(xp.total).toBe(10);
  });

  it("gives 5 for an extra catalog measure", () => {
    const xp = computeXp([reading("blood_glucose", DAY)], null, OPTS);
    expect(xp.total).toBe(5);
  });

  it("gives 80 + 50 = 130 for all 8 steps", () => {
    const xp = computeXp(EIGHT.map(([metric, at]) => reading(metric, at)), null, OPTS);
    expect(xp.total).toBe(130);
    expect(xp.fullCheckToday).toBe(true);
  });

  it("gives +10 for a watch extra step without blocking the bonus", () => {
    const res = result([{ metric: "blood_glucose", status: "watch" }]);
    const xp = computeXp(
      [...EIGHT.map(([metric, at]) => reading(metric, at)), reading("blood_glucose", DAY)],
      res,
      OPTS
    );
    expect(xp.total).toBe(140);
    expect(xp.fullCheckToday).toBe(true);
  });

  it("gives 0 for an estimate and 0 for a voided reading", () => {
    expect(computeXp([reading("heart_rate", DAY, { is_estimate: 1 })], null, OPTS).total).toBe(0);
    expect(computeXp([reading("heart_rate", DAY, { voided: 1 })], null, OPTS).total).toBe(0);
  });

  it("ignores synthetic readings from another device in a demo, and counts this device's", () => {
    const other = reading("heart_rate", DAY, { provenance: "synthetic", device_id: "other-device" });
    expect(computeXp([other], null, { ...OPTS, demo: true, deviceId: "device-1" }).total).toBe(0);
    const own = reading("heart_rate", DAY, { provenance: "synthetic", device_id: "device-1" });
    expect(computeXp([own], null, { ...OPTS, demo: true, deviceId: "device-1" }).total).toBe(10);
  });

  it("counts a real reading from another device", () => {
    const m = reading("heart_rate", DAY, { provenance: "real", device_id: "other-device" });
    expect(computeXp([m], null, { ...OPTS, demo: true, deviceId: "device-1" }).total).toBe(10);
    expect(eligibleForXp(m, { demo: true, deviceId: "device-1" })).toBe(true);
  });

  it("adds two separate days together", () => {
    const xp = computeXp([reading("heart_rate", YESTERDAY), reading("heart_rate", DAY)], null, OPTS);
    expect(xp.total).toBe(20);
    expect(xp.today).toBe(10);
  });

  it("applies the rank thresholds", () => {
    expect(computeXp([], null, OPTS).rank).toBe("Cadet");
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => {
        const day = new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString();
        return reading("blood_glucose", day);
      });
    expect(computeXp(many(19), null, OPTS).total).toBe(95);
    expect(computeXp(many(19), null, OPTS).rank).toBe("Cadet");
    expect(computeXp(many(20), null, OPTS).total).toBe(100);
    expect(computeXp(many(20), null, OPTS).rank).toBe("Specialist");
    expect(computeXp(many(20), null, OPTS).level).toBe(2);
    expect(computeXp(many(400), null, OPTS).rank).toBe("Mission Veteran");
    expect(computeXp(many(400), null, OPTS).nextLevelAt).toBeNull();
  });

  it("earns the same XP for a critical value as a nominal one", () => {
    const nominal = computeXp([reading("heart_rate", DAY, { value_num: 62 })], null, OPTS);
    const critical = computeXp([reading("heart_rate", DAY, { value_num: 190 })], null, OPTS);
    expect(critical.total).toBe(nominal.total);
    expect(critical.total).toBe(10);
  });
});

describe("xpGain", () => {
  it("reports the gain, a level-up and the full check", () => {
    const before = summary(90, 1, "Cadet", false);
    const after = summary(130, 2, "Specialist", true);
    expect(xpGain(before, after)).toEqual({ gained: 40, levelUp: true, newRank: "Specialist", fullCheck: true });
  });

  it("reports no level-up when the rank does not change", () => {
    expect(xpGain(summary(10), summary(20))).toEqual({ gained: 10, levelUp: false, newRank: null, fullCheck: false });
  });
});

describe("re-check extras apply to today only", () => {
  const PAST = "2026-11-10T12:00:00.000Z";
  const watchGlucose = result([{ metric: "blood_glucose", status: "watch" }]);
  const nominalGlucose = result([{ metric: "blood_glucose", status: "nominal" }]);

  it("scores a past day the same whatever the latest result says", () => {
    const history = [reading("heart_rate", PAST), reading("blood_glucose", PAST)];
    expect(computeXp(history, watchGlucose, OPTS).total).toBe(15);
    expect(computeXp(history, nominalGlucose, OPTS).total).toBe(15);
    expect(computeXp(history, null, OPTS).total).toBe(15);
  });

  it("still earns +10 for a watch extra read today", () => {
    expect(computeXp([reading("blood_glucose", DAY)], watchGlucose, OPTS).total).toBe(10);
    expect(computeXp([reading("blood_glucose", DAY)], nominalGlucose, OPTS).total).toBe(5);
  });

  it("never drops the total when a measure returns to nominal", () => {
    const history = [
      reading("heart_rate", PAST),
      reading("blood_glucose", PAST),
      reading("heart_rate", "2026-11-11T12:00:00.000Z"),
    ];
    const before = computeXp(history, watchGlucose, OPTS).total;
    const after = computeXp(history, nominalGlucose, OPTS).total;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
