import { describe, expect, it } from "vitest";
import { lookupMeasure } from "@starplus/core";
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

describe("reserved values", () => {
  it("rejects SFLOAT NaN, NRes and infinities in blood pressure", () => {
    for (const reserved of [0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801]) {
      const systolic = simulateBloodPressure(120, 80);
      systolic.setUint16(1, reserved, true);
      expect(parseBloodPressure(systolic)).toBeNull();
      const diastolic = simulateBloodPressure(120, 80);
      diastolic.setUint16(3, reserved, true);
      expect(parseBloodPressure(diastolic)).toBeNull();
    }
  });

  it("drops a reserved pulse rate but keeps the pair", () => {
    const view = simulateBloodPressure(120, 80, { pulseRate: 70 });
    view.setUint16(7, 0x07ff, true);
    const reading = parseBloodPressure(view);
    expect(reading?.systolic.value).toBe(120);
    expect(reading?.pulseRate).toBeNull();
  });

  it("rejects FLOAT NaN, NRes and infinities in temperature", () => {
    for (const reserved of [0x007fffff, 0x00800000, 0x007ffffe, 0x00800002, 0x00800001]) {
      const view = new DataView(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00]).buffer);
      view.setUint32(1, reserved, true);
      expect(parseTemperature(view)).toBeNull();
    }
  });

  it("rejects a reserved SpO2 and drops a reserved pulse rate", () => {
    const spo2 = simulatePulseOximeter(98, 66);
    spo2.setUint16(1, 0x07ff, true);
    expect(parsePulseOximeter(spo2)).toBeNull();
    const pulse = simulatePulseOximeter(98, 66);
    pulse.setUint16(3, 0x0800, true);
    const reading = parsePulseOximeter(pulse);
    expect(reading?.spo2.value).toBe(98);
    expect(reading?.pulseRate).toBeNull();
  });

  it("rejects weight 0xFFFF", () => {
    const view = simulateWeight(70);
    view.setUint16(1, 0xffff, true);
    expect(parseWeight(view)).toBeNull();
  });
});

describe("catalog units", () => {
  it("matches every parser output unit to the catalog", () => {
    const hr = parseHeartRate(simulateHeartRate(72))!;
    expect(hr.unit).toBe(lookupMeasure(hr.metric)!.unit);
    const bp = parseBloodPressure(simulateBloodPressure(120, 80))!;
    expect(bp.systolic.unit).toBe(lookupMeasure(bp.systolic.metric)!.unit);
    expect(bp.diastolic.unit).toBe(lookupMeasure(bp.diastolic.metric)!.unit);
    const temp = parseTemperature(simulateTemperature(37))!;
    expect(temp.unit).toBe(lookupMeasure(temp.metric)!.unit);
    const glucose = parseGlucose(simulateGlucose(99.09, 1, "2026-11-08T10:00:00Z"))!;
    expect(glucose.unit).toBe(lookupMeasure(glucose.metric)!.unit);
    const plx = parsePulseOximeter(simulatePulseOximeter(98, 66))!;
    expect(plx.spo2.unit).toBe(lookupMeasure(plx.spo2.metric)!.unit);
    expect(plx.pulseRate!.unit).toBe(lookupMeasure(plx.pulseRate!.metric)!.unit);
    const weight = parseWeight(simulateWeight(70))!;
    expect(weight.unit).toBe(lookupMeasure(weight.metric)!.unit);
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
      unit: "°C",
    });
  });

  it("converts Fahrenheit to Celsius", () => {
    expect(parseTemperature(simulateTemperature(37, true))?.value).toBeCloseTo(37, 1);
  });
});

describe("glucose", () => {
  it("parses a mol/L concentration as mg/dL", () => {
    const reading = parseGlucose(simulateGlucose(99.09, 42, "2026-11-08T10:00:00Z"));
    expect(reading).toMatchObject({
      metric: "blood_glucose",
      value: 99.09,
      unit: "mg/dL",
      sequenceNumber: 42,
      measuredAt: "2026-11-08T10:00:00Z",
    });
  });

  it("parses a kg/L concentration as mg/dL", () => {
    const reading = parseGlucose(simulateGlucose(100, 7, "2026-11-08T10:00:00Z", { unit: "kg/L" }));
    expect(reading?.value).toBeCloseTo(100, 0);
    expect(reading?.unit).toBe("mg/dL");
  });

  it("applies the time offset to the base time", () => {
    const reading = parseGlucose(
      simulateGlucose(99.09, 42, "2026-11-08T10:00:00Z", { timeOffsetMinutes: 5 })
    );
    expect(reading?.measuredAt).toBe("2026-11-08T10:05:00Z");
  });

  it("rejects a reserved concentration", () => {
    const view = simulateGlucose(99.09, 42, "2026-11-08T10:00:00Z");
    view.setUint16(10, 0x07ff, true);
    expect(parseGlucose(view)).toBeNull();
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
