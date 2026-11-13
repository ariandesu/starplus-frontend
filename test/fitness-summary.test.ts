import { describe, expect, it } from "vitest";
import type { Measurement } from "@starplus/core";
import { summarizeFitness } from "../src/lib/fitness-summary";

const NOW = Date.parse("2026-11-13T12:00:00Z");

function reading(metric: string, value_num: number, measured_at: string): Measurement {
  return {
    client_id: `c-${metric}-${measured_at}`,
    crew_id: "crew-1",
    metric,
    value_num,
    value_text: null,
    unit: "x",
    measured_at,
    received_at: measured_at,
    source: "manual",
    device_id: "",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
  } as Measurement;
}

describe("summarizeFitness", () => {
  it("returns an empty summary with no readings", () => {
    expect(summarizeFitness([], NOW)).toEqual({
      activeMinutes7d: 0,
      activeDays: [],
      avgSleep7d: null,
      sleepNights: 0,
      latestMassKg: null,
      latestMassAt: null,
      massDelta30dKg: null,
      checkinDays7d: 0,
    });
  });

  it("totals activity and sleep inside 7 days and ignores older rows", () => {
    const summary = summarizeFitness(
      [
        reading("physical_activity", 30, "2026-11-12T08:00:00Z"),
        reading("physical_activity", 20, "2026-11-12T18:00:00Z"),
        reading("physical_activity", 45, "2026-11-10T08:00:00Z"),
        reading("physical_activity", 99, "2026-10-01T08:00:00Z"),
        reading("sleep_hours", 7, "2026-11-12T08:00:00Z"),
        reading("sleep_hours", 8, "2026-11-11T08:00:00Z"),
      ],
      NOW
    );
    expect(summary.activeMinutes7d).toBe(95);
    expect(summary.activeDays).toEqual([
      { date: "2026-11-10", minutes: 45 },
      { date: "2026-11-12", minutes: 50 },
    ]);
    expect(summary.avgSleep7d).toBeCloseTo(7.5);
    expect(summary.sleepNights).toBe(2);
    expect(summary.checkinDays7d).toBe(3);
  });

  it("reports the latest body mass and its 30-day change", () => {
    const summary = summarizeFitness(
      [
        reading("body_mass", 80, "2026-10-20T08:00:00Z"),
        reading("body_mass", 79, "2026-11-12T08:00:00Z"),
        reading("body_mass", 81, "2026-09-01T08:00:00Z"),
      ],
      NOW
    );
    expect(summary.latestMassKg).toBe(79);
    expect(summary.latestMassAt).toBe("2026-11-12T08:00:00Z");
    expect(summary.massDelta30dKg).toBeCloseTo(-1);
  });

  it("reports no mass change with a single reading", () => {
    const summary = summarizeFitness([reading("body_mass", 80, "2026-11-12T08:00:00Z")], NOW);
    expect(summary.latestMassKg).toBe(80);
    expect(summary.massDelta30dKg).toBeNull();
  });
});
