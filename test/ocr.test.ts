import { describe, expect, it } from "vitest";
import { parseDisplayReading } from "../src/lib/adapters/ocr";

describe("parseDisplayReading", () => {
  it("reads a blood pressure pair with a slash", () => {
    expect(parseDisplayReading("120/80 mmHg")).toEqual([
      { value: 120, unit: "mmHg", metric: "blood_pressure_systolic" },
      { value: 80, unit: "mmHg", metric: "blood_pressure_diastolic" },
    ]);
  });

  it("reads a blood pressure pair with over", () => {
    expect(parseDisplayReading("BP 118 over 76")).toEqual([
      { value: 118, unit: "mmHg", metric: "blood_pressure_systolic" },
      { value: 76, unit: "mmHg", metric: "blood_pressure_diastolic" },
    ]);
  });

  it("converts Fahrenheit to Celsius", () => {
    expect(parseDisplayReading("98.6°F")).toEqual([{ value: 37, unit: "°C", metric: "temperature_c" }]);
  });

  it("reads single values with units", () => {
    expect(parseDisplayReading("72 bpm")).toEqual([{ value: 72, unit: "bpm", metric: "heart_rate" }]);
    expect(parseDisplayReading("SPO2 98%")).toEqual([{ value: 98, unit: "%", metric: "oxygen_saturation" }]);
    expect(parseDisplayReading("5.5 mmol/L")).toEqual([{ value: 99.09, unit: "mg/dL", metric: "blood_glucose" }]);
    expect(parseDisplayReading("70.5 kg")).toEqual([{ value: 70.5, unit: "kg", metric: "body_mass" }]);
  });

  it("leaves a bare number without a measure", () => {
    expect(parseDisplayReading("120")).toEqual([]);
    const [reading] = parseDisplayReading("80 mmHg");
    expect(reading).toEqual({ value: 80, unit: "mmHg", metric: null });
  });
});
