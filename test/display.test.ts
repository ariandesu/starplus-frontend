import { describe, expect, it } from "vitest";
import { formatLocalDateTime, formatMetricValue } from "../src/lib/display";

describe("formatMetricValue", () => {
  it("rounds whole-number measures", () => {
    expect(formatMetricValue("heart_rate", 61.6)).toBe("62");
    expect(formatMetricValue("blood_pressure_systolic", 141.4)).toBe("141");
    expect(formatMetricValue("oxygen_saturation", 97.6)).toBe("98");
    expect(formatMetricValue("reaction_time", 268.4)).toBe("268");
    expect(formatMetricValue("calories", 2217.6)).toBe("2,218");
    expect(formatMetricValue("physical_activity", 43.89)).toBe("44");
    expect(formatMetricValue("respiratory_rate", 11.6)).toBe("12");
    expect(formatMetricValue("blood_glucose", 90.6)).toBe("91");
    expect(formatMetricValue("mood_score", 59.47)).toBe("59");
  });

  it("groups thousands like the result and body pages show", () => {
    expect(formatMetricValue("calories", 2192)).toBe("2,192");
    expect(formatMetricValue("mood_score", 55)).toBe("55");
  });

  it("keeps one decimal where the unit needs it", () => {
    expect(formatMetricValue("temperature_c", 37.14)).toBe("37.1");
    expect(formatMetricValue("sleep_hours", 7.21)).toBe("7.2");
    expect(formatMetricValue("water_intake", 2.04)).toBe("2.0");
    expect(formatMetricValue("body_mass", 76.63)).toBe("76.6");
    expect(formatMetricValue("radiation_dose", 0.54)).toBe("0.5");
  });

  it("keeps three decimals for urine specific gravity", () => {
    expect(formatMetricValue("urine_specific_gravity", 1.0175)).toBe("1.018");
  });

  it("passes through text and empties", () => {
    expect(formatMetricValue("heart_rate", null)).toBe("—");
    expect(formatMetricValue("heart_rate", "text")).toBe("text");
  });
});

describe("formatLocalDateTime", () => {
  it("uses one local format", () => {
    const iso = new Date(2026, 10, 12, 0, 10).toISOString();
    expect(formatLocalDateTime(iso)).toBe("Thu 12 Nov, 00:10");
  });

  it("handles empties", () => {
    expect(formatLocalDateTime(null)).toBe("");
    expect(formatLocalDateTime("")).toBe("");
  });
});
