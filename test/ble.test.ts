import { describe, expect, it } from "vitest";
import { BLE_PROFILES } from "../src/lib/adapters/ble-profiles";
import {
  parseBloodPressure,
  parseGlucose,
  parseHeartRate,
  parsePulseOximeter,
  parseTemperature,
  parseWeight,
} from "../src/lib/adapters/ble-parse";
import {
  simulateBloodPressure,
  simulateGlucose,
  simulateHeartRate,
  simulatePulseOximeter,
  simulateTemperature,
  simulateWeight,
} from "../src/lib/adapters/ble-simulator";

describe("BLE profiles", () => {
  it("covers six standard health profiles", () => {
    expect(BLE_PROFILES.map((profile) => profile.id)).toEqual([
      "heart-rate",
      "blood-pressure",
      "thermometer",
      "glucose",
      "pulse-oximeter",
      "weight-scale",
    ]);
  });
});

describe("heart rate", () => {
  it("parses an 8-bit measurement", () => {
    expect(parseHeartRate(simulateHeartRate(72))).toMatchObject({ value: 72, unit: "bpm" });
  });

  it("parses a 16-bit measurement with energy expended", () => {
    const reading = parseHeartRate(simulateHeartRate(300, 41));
    expect(reading).toMatchObject({ value: 300, unit: "bpm", energyExpendedKj: 41 });
  });

  it("rejects truncated input", () => {
    expect(parseHeartRate(new DataView(new Uint8Array([0x01]).buffer))).toBeNull();
  });
});

describe("blood pressure", () => {
  it("parses systolic, diastolic and pulse rate", () => {
    const reading = parseBloodPressure(
      simulateBloodPressure(120, 80, { pulseRate: 70, measuredAt: "2026-11-08T10:00:00Z" })
    );
    expect(reading?.systolic).toMatchObject({ metric: "blood_pressure_systolic", value: 120, unit: "mmHg" });
    expect(reading?.diastolic).toMatchObject({ metric: "blood_pressure_diastolic", value: 80, unit: "mmHg" });
    expect(reading?.pulseRate).toBe(70);
    expect(reading?.measuredAt).toBe("2026-11-08T10:00:00Z");
  });

  it("converts kilopascals to millimetres of mercury", () => {
    const reading = parseBloodPressure(simulateBloodPressure(120, 80, { kpa: true }));
    expect(reading?.systolic.value).toBeCloseTo(120, 0);
    expect(reading?.diastolic.value).toBeCloseTo(80, 0);
  });
});

describe("thermometer", () => {
  it("parses a Celsius measurement", () => {
    expect(parseTemperature(simulateTemperature(37.5))).toMatchObject({
      metric: "temperature_c",
      value: 37.5,
      unit: "degC",
    });
  });

  it("converts Fahrenheit to Celsius", () => {
    expect(parseTemperature(simulateTemperature(37, true))?.value).toBeCloseTo(37, 1);
  });
});

describe("glucose", () => {
  it("parses concentration, sequence and timestamp", () => {
    const reading = parseGlucose(simulateGlucose(5.5, 42, "2026-11-08T10:00:00Z"));
    expect(reading).toMatchObject({
      metric: "blood_glucose",
      value: 5.5,
      unit: "mmol/L",
      sequenceNumber: 42,
      measuredAt: "2026-11-08T10:00:00Z",
    });
  });
});

describe("pulse oximeter", () => {
  it("parses SpO2 and pulse rate", () => {
    const reading = parsePulseOximeter(simulatePulseOximeter(98.4, 66, "2026-11-08T10:00:00Z"));
    expect(reading?.spo2).toMatchObject({ metric: "oxygen_saturation", value: 98.4, unit: "%" });
    expect(reading?.pulseRate).toMatchObject({ metric: "heart_rate", value: 66, unit: "bpm" });
    expect(reading?.measuredAt).toBe("2026-11-08T10:00:00Z");
  });
});

describe("weight scale", () => {
  it("parses an SI measurement", () => {
    expect(parseWeight(simulateWeight(78.5))).toMatchObject({ metric: "body_mass", value: 78.5, unit: "kg" });
  });

  it("converts pounds to kilograms", () => {
    expect(parseWeight(simulateWeight(78.5, true))?.value).toBeCloseTo(78.5, 1);
  });
});
