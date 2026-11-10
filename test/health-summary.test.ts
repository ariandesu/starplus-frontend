import { describe, expect, it } from "vitest";
import type { OverallStatus, PerMeasureResult, Result } from "@starplus/core";
import {
  countByStatus,
  latestPerMeasure,
  summarySentence,
  systemStatus,
} from "../src/lib/health-summary";

function measure(metric: string, status: OverallStatus): PerMeasureResult {
  return {
    metric,
    status,
    status_source: "personal_baseline",
    reason_code: "within_limits",
    values: {
      value: 1,
      unit: "u",
      client_id: `${metric}-${status}`,
      baseline_mean: null,
      baseline_n: 0,
      window_mean: null,
      z_score: null,
      trend: null,
      confirm_required: false,
      refuted: [],
    },
  };
}

function result(clientId: string, assessedAt: string, perMeasure: PerMeasureResult[]): Result {
  return {
    client_id: clientId,
    crew_id: "crew-1",
    assessed_at: assessedAt,
    overall_status: "nominal",
    per_measure: perMeasure,
    model_advice: null,
    model_id: "model",
    model_version: "1",
    catalog_version: "1",
    kb_version: "1",
    inputs_hash: "hash",
    received_at: assessedAt,
  };
}

describe("latest per measure", () => {
  it("returns nothing for no results", () => {
    expect(latestPerMeasure([])).toEqual([]);
  });

  it("keeps every measure of a single result", () => {
    const entries = latestPerMeasure([
      result("r1", "2026-11-10T08:00:00.000Z", [measure("heart_rate", "watch"), measure("mood_score", "nominal")]),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.assessed_at === "2026-11-10T08:00:00.000Z")).toBe(true);
    expect(entries.map((entry) => entry.metric).sort()).toEqual(["heart_rate", "mood_score"]);
  });

  it("lets a newer result replace a measure and keeps the older one for the rest", () => {
    const entries = latestPerMeasure([
      result("r2", "2026-11-10T12:00:00.000Z", [measure("heart_rate", "critical")]),
      result("r1", "2026-11-10T08:00:00.000Z", [measure("heart_rate", "watch"), measure("mood_score", "nominal")]),
    ]);
    const byMetric = new Map(entries.map((entry) => [entry.metric, entry]));
    expect(byMetric.get("heart_rate")?.status).toBe("critical");
    expect(byMetric.get("heart_rate")?.assessed_at).toBe("2026-11-10T12:00:00.000Z");
    expect(byMetric.get("mood_score")?.status).toBe("nominal");
    expect(byMetric.get("mood_score")?.assessed_at).toBe("2026-11-10T08:00:00.000Z");
  });
});

describe("status counts", () => {
  it("counts the four statuses", () => {
    const counts = countByStatus([
      measure("a", "nominal"),
      measure("b", "nominal"),
      measure("c", "watch"),
      measure("d", "critical"),
      measure("e", "insufficient"),
    ]);
    expect(counts).toEqual({ nominal: 2, watch: 1, critical: 1, insufficient: 1 });
  });

  it("counts nothing when there are no entries", () => {
    expect(countByStatus([])).toEqual({ nominal: 0, watch: 0, critical: 0, insufficient: 0 });
  });
});

describe("system status", () => {
  const lungs = { measures: ["respiratory_rate", "oxygen_saturation"] };

  it("returns null when the system has no entry", () => {
    expect(systemStatus(lungs, [measure("heart_rate", "critical")])).toBeNull();
    expect(systemStatus(lungs, [])).toBeNull();
  });

  it("picks the most severe status of the system's own measures", () => {
    const entries = [
      measure("respiratory_rate", "nominal"),
      measure("oxygen_saturation", "watch"),
      measure("heart_rate", "critical"),
    ];
    expect(systemStatus(lungs, entries)).toBe("watch");
  });

  it("orders critical over watch over nominal over insufficient", () => {
    const withCritical = [
      measure("respiratory_rate", "insufficient"),
      measure("oxygen_saturation", "critical"),
      measure("heart_rate", "nominal"),
    ];
    expect(systemStatus(lungs, withCritical)).toBe("critical");
    expect(systemStatus(lungs, [measure("respiratory_rate", "nominal"), measure("oxygen_saturation", "watch")])).toBe("watch");
    expect(systemStatus(lungs, [measure("respiratory_rate", "insufficient"), measure("oxygen_saturation", "nominal")])).toBe("nominal");
    expect(systemStatus(lungs, [measure("respiratory_rate", "insufficient")])).toBe("insufficient");
  });
});

describe("summary sentence", () => {
  const none = { nominal: 0, watch: 0, critical: 0, insufficient: 0 };

  it("uses the fixed sentences from the plan", () => {
    expect(summarySentence({ ...none, critical: 2 })).toBe("2 measures critical.");
    expect(summarySentence({ ...none, critical: 1 })).toBe("1 measure critical.");
    expect(summarySentence({ ...none, watch: 1 })).toBe("1 measure to watch.");
    expect(summarySentence({ ...none, nominal: 3 })).toBe("All measured values are nominal.");
    expect(summarySentence(none)).toBe("No check-in yet.");
  });

  it("prefers critical over watch and watch over nominal", () => {
    expect(summarySentence({ nominal: 2, watch: 1, critical: 1, insufficient: 0 })).toBe("1 measure critical.");
    expect(summarySentence({ nominal: 2, watch: 1, critical: 0, insufficient: 0 })).toBe("1 measure to watch.");
  });
});
