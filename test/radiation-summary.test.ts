import { describe, expect, it } from "vitest";
import type { Measurement } from "@starplus/core";
import { CAREER_LIMIT_MSV, summarizeRadiation } from "../src/lib/radiation-summary";

function reading(value_num: number, measured_at: string): Measurement {
  return {
    client_id: `c-${measured_at}`,
    crew_id: "crew-1",
    metric: "radiation_dose",
    value_num,
    value_text: null,
    unit: "mSv",
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

describe("summarizeRadiation", () => {
  it("returns an empty summary with no readings", () => {
    const summary = summarizeRadiation([]);
    expect(summary).toEqual({
      totalMsv: 0,
      percentOfCareerLimit: 0,
      milestone: 0,
      readingCount: 0,
      latestAt: null,
      days: [],
    });
  });

  it("ignores other measures and null values", () => {
    const other = { ...reading(5, "2026-11-01T08:00:00Z"), metric: "heart_rate" };
    const summary = summarizeRadiation([other, reading(0.5, "2026-11-02T08:00:00Z")]);
    expect(summary.readingCount).toBe(1);
    expect(summary.totalMsv).toBeCloseTo(0.5);
  });

  it("sums readings and reports the share of the 600 mSv career limit", () => {
    const summary = summarizeRadiation([
      reading(0.5, "2026-11-01T08:00:00Z"),
      reading(0.5, "2026-11-11T08:00:00Z"),
      reading(0.5, "2026-11-12T08:00:00Z"),
    ]);
    expect(summary.totalMsv).toBeCloseTo(1.5);
    expect(CAREER_LIMIT_MSV).toBe(600);
    expect(summary.percentOfCareerLimit).toBeCloseTo(0.25);
    expect(summary.milestone).toBe(0);
    expect(summary.latestAt).toBe("2026-11-12T08:00:00Z");
  });

  it("raises the milestone at 25, 50 and 75 percent", () => {
    expect(summarizeRadiation([reading(150, "2026-11-01T08:00:00Z")]).milestone).toBe(25);
    expect(summarizeRadiation([reading(300, "2026-11-01T08:00:00Z")]).milestone).toBe(50);
    expect(summarizeRadiation([reading(450, "2026-11-01T08:00:00Z")]).milestone).toBe(75);
  });

  it("groups readings by day, oldest first", () => {
    const summary = summarizeRadiation([
      reading(0.5, "2026-11-12T20:00:00Z"),
      reading(0.2, "2026-11-12T08:00:00Z"),
      reading(0.5, "2026-11-02T08:00:00Z"),
    ]);
    expect(summary.days).toEqual([
      { date: "2026-11-02", mSv: 0.5 },
      { date: "2026-11-12", mSv: 0.7 },
    ]);
  });
});
