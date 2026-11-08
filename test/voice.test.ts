import { describe, expect, it } from "vitest";
import { extractReadings, parseSpokenNumber } from "../src/lib/adapters/voice";

describe("parseSpokenNumber", () => {
  it.each([
    ["zero", 0],
    ["seven", 7],
    ["nineteen", 19],
    ["seventy two", 72],
    ["one hundred and twenty", 120],
    ["two thousand three hundred and four", 2304],
    ["ninety eight point four", 98.4],
    ["thirty seven point five", 37.5],
    ["minus five", -5],
    ["negative twelve", -12],
    ["one hundred", 100],
  ])("parses %s as %s", (text, expected) => {
    expect(parseSpokenNumber(text)).toBe(expected);
  });

  it.each([[""], ["hello"], ["seventy apples"], ["point five six seven"], ["hundred"]])(
    "rejects %s",
    (text) => {
      expect(parseSpokenNumber(text)).toBeNull();
    }
  );
});

describe("extractReadings", () => {
  it.each([
    ["seventy two beats per minute", [{ value: 72, unit: "bpm", metric: "heart_rate" }]],
    ["my heart rate is seventy two", [{ value: 72, unit: "bpm", metric: "heart_rate" }]],
    [
      "one twenty over eighty",
      [
        { value: 120, unit: "mmHg", metric: "blood_pressure_systolic" },
        { value: 80, unit: "mmHg", metric: "blood_pressure_diastolic" },
      ],
    ],
    [
      "one hundred twenty over eighty",
      [
        { value: 120, unit: "mmHg", metric: "blood_pressure_systolic" },
        { value: 80, unit: "mmHg", metric: "blood_pressure_diastolic" },
      ],
    ],
    ["oxygen ninety eight percent", [{ value: 98, unit: "%", metric: "oxygen_saturation" }]],
    ["temperature thirty seven point two", [{ value: 37.2, unit: "°C", metric: "temperature_c" }]],
    [
      "blood pressure one ten over seventy",
      [
        { value: 110, unit: "mmHg", metric: "blood_pressure_systolic" },
        { value: 70, unit: "mmHg", metric: "blood_pressure_diastolic" },
      ],
    ],
    ["my glucose is ninety five", [{ value: 95, unit: "mg/dL", metric: "blood_glucose" }]],
    ["i weigh seventy eight kilos", [{ value: 78, unit: "kg", metric: "body_mass" }]],
    ["breathing rate fourteen", [{ value: 14, unit: "/min", metric: "respiratory_rate" }]],
    ["pulse sixty six", [{ value: 66, unit: "bpm", metric: "heart_rate" }]],
  ])("extracts readings from %s", (text, expected) => {
    expect(extractReadings(text)).toEqual(expected);
  });

  it("returns nothing for prose without numbers", () => {
    expect(extractReadings("feeling fine today")).toEqual([]);
  });
});
