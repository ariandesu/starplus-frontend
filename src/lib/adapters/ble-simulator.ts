import { encodeFloat32, encodeSfloat, encodeTimestamp } from "./ble-parse.ts";

function bytes(...values: number[]): DataView {
  return new DataView(new Uint8Array(values).buffer);
}

function sfloatBytes(value: number, exponent: number): [number, number] {
  const encoded = encodeSfloat(value, exponent);
  return [encoded & 0xff, (encoded >> 8) & 0xff];
}

function floatBytes(value: number, exponent: number): [number, number, number, number] {
  const encoded = encodeFloat32(value, exponent);
  return [encoded & 0xff, (encoded >> 8) & 0xff, (encoded >> 16) & 0xff, (encoded >> 24) & 0xff];
}

export function simulateHeartRate(bpm: number, energyExpendedKj?: number): DataView {
  const wide = bpm > 255;
  const flags = (wide ? 0x01 : 0x00) | (energyExpendedKj !== undefined ? 0x08 : 0x00);
  const out: number[] = [flags];
  if (wide) out.push(bpm & 0xff, (bpm >> 8) & 0xff);
  else out.push(bpm);
  if (energyExpendedKj !== undefined) out.push(energyExpendedKj & 0xff, (energyExpendedKj >> 8) & 0xff);
  return bytes(...out);
}

export function simulateBloodPressure(
  systolicMmHg: number,
  diastolicMmHg: number,
  options: { pulseRate?: number; measuredAt?: string; kpa?: boolean } = {}
): DataView {
  const flags = (options.kpa ? 0x01 : 0x00) | (options.measuredAt ? 0x02 : 0x00) | (options.pulseRate !== undefined ? 0x04 : 0x00);
  const toUnit = (v: number) => (options.kpa ? v / 7.500_616_83 : v);
  const out: number[] = [
    flags,
    ...sfloatBytes(toUnit(systolicMmHg), -1),
    ...sfloatBytes(toUnit(diastolicMmHg), -1),
    ...sfloatBytes(toUnit((systolicMmHg + 2 * diastolicMmHg) / 3), -1),
  ];
  if (options.measuredAt) out.push(...encodeTimestamp(options.measuredAt));
  if (options.pulseRate !== undefined) out.push(...sfloatBytes(options.pulseRate, 0));
  return bytes(...out);
}

export function simulateTemperature(celsius: number, fahrenheit = false): DataView {
  const value = fahrenheit ? (celsius * 9) / 5 + 32 : celsius;
  return bytes(fahrenheit ? 0x01 : 0x00, ...floatBytes(value, -2));
}

export function simulateGlucose(mmolPerL: number, sequenceNumber: number, measuredAt: string): DataView {
  return bytes(
    0x06,
    sequenceNumber & 0xff,
    (sequenceNumber >> 8) & 0xff,
    ...encodeTimestamp(measuredAt),
    ...sfloatBytes(mmolPerL / 1000, -5),
    0x00
  );
}

export function simulatePulseOximeter(spo2Pct: number, pulseRate: number, measuredAt?: string): DataView {
  const out: number[] = [
    measuredAt ? 0x01 : 0x00,
    ...sfloatBytes(spo2Pct, -1),
    ...sfloatBytes(pulseRate, 0),
  ];
  if (measuredAt) out.push(...encodeTimestamp(measuredAt));
  return bytes(...out);
}

export function simulateWeight(weightKg: number, imperial = false, measuredAt?: string): DataView {
  const raw = imperial ? Math.round(weightKg / 0.453_592_37 / 0.01) : Math.round(weightKg / 0.005);
  const out: number[] = [(imperial ? 0x01 : 0x00) | (measuredAt ? 0x02 : 0x00), raw & 0xff, (raw >> 8) & 0xff];
  if (measuredAt) out.push(...encodeTimestamp(measuredAt));
  return bytes(...out);
}
