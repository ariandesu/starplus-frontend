import { describe, expect, it } from "vitest";
import { sortVitals } from "../src/lib/vital-order";

const vital = (metric: string, status: string) => ({ metric, status });

describe("sortVitals", () => {
  it("lists non-nominal measures first", () => {
    const sorted = sortVitals([
      vital("heart_rate", "nominal"),
      vital("oxygen_saturation", "critical"),
      vital("temperature_c", "nominal"),
      vital("mood_score", "watch"),
    ]);
    expect(sorted.map((item) => item.metric)).toEqual([
      "oxygen_saturation",
      "mood_score",
      "heart_rate",
      "temperature_c",
    ]);
  });

  it("orders key vitals before the rest", () => {
    const sorted = sortVitals([
      vital("calories", "nominal"),
      vital("blood_pressure_diastolic", "nominal"),
      vital("heart_rate", "nominal"),
    ]);
    expect(sorted.map((item) => item.metric)).toEqual([
      "heart_rate",
      "blood_pressure_diastolic",
      "calories",
    ]);
  });

  it("puts insufficient after nominal", () => {
    const sorted = sortVitals([
      vital("heart_rate", "insufficient"),
      vital("oxygen_saturation", "nominal"),
    ]);
    expect(sorted.map((item) => item.metric)).toEqual(["oxygen_saturation", "heart_rate"]);
  });
});
