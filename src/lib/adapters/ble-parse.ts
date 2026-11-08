export interface HeartRateReading {
  metric: "heart_rate";
  value: number;
  unit: "bpm";
  energyExpendedKj: number | null;
}

export interface BloodPressureReading {
  systolic: { metric: "blood_pressure_systolic"; value: number; unit: "mmHg" };
  diastolic: { metric: "blood_pressure_diastolic"; value: number; unit: "mmHg" };
  pulseRate: number | null;
  measuredAt: string | null;
}

export interface TemperatureReading {
  metric: "temperature_c";
  value: number;
  unit: "°C";
}

export interface GlucoseReading {
  metric: "blood_glucose";
  value: number;
  unit: "mg/dL";
  sequenceNumber: number;
  measuredAt: string;
}

export interface PulseOximeterReading {
  spo2: { metric: "oxygen_saturation"; value: number; unit: "%" };
  pulseRate: { metric: "heart_rate"; value: number; unit: "bpm" } | null;
  measuredAt: string | null;
}

export interface WeightReading {
  metric: "body_mass";
  value: number;
  unit: "kg";
  measuredAt: string | null;
}

const RESERVED_SFLOAT = new Set([0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801]);
const RESERVED_FLOAT = new Set([0x007fffff, 0x00800000, 0x007ffffe, 0x00800002, 0x00800001]);

export const MGDL_PER_MOLL = 18_015.59;

export function decodeSfloat(view: DataView, offset: number): number | null {
  const raw = view.getUint16(offset, true);
  if (RESERVED_SFLOAT.has(raw)) return null;
  let mantissa = raw & 0x0fff;
  if (mantissa & 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x000f;
  if (exponent & 0x08) exponent -= 0x10;
  return mantissa * 10 ** exponent;
}

export function decodeFloatBits(raw: number): number | null {
  if (RESERVED_FLOAT.has(raw)) return null;
  const bytes = new DataView(new Uint8Array(4).buffer);
  bytes.setUint32(0, raw, true);
  let mantissa = bytes.getUint8(0) | (bytes.getUint8(1) << 8) | (bytes.getUint8(2) << 16);
  if (mantissa & 0x800000) mantissa -= 0x1000000;
  const exponent = bytes.getInt8(3);
  return mantissa * 10 ** exponent;
}

export function encodeSfloat(value: number, exponent: number): number {
  const mantissa = Math.round(value / 10 ** exponent);
  if (mantissa < -2048 || mantissa > 2047) throw new Error(`value ${value} does not fit SFLOAT at 1e${exponent}`);
  const biased = ((exponent & 0x0f) << 12) | (mantissa & 0x0fff);
  return biased;
}

export function encodeFloat32(value: number, exponent: number): number {
  const mantissa = Math.round(value / 10 ** exponent);
  const bytes = new Uint8Array(4);
  const unsigned = mantissa & 0xffffff;
  bytes[0] = unsigned & 0xff;
  bytes[1] = (unsigned >> 8) & 0xff;
  bytes[2] = (unsigned >> 16) & 0xff;
  bytes[3] = exponent & 0xff;
  return new DataView(bytes.buffer).getUint32(0, true);
}

export function decodeTimestamp(view: DataView, offset: number): string {
  const year = view.getUint16(offset, true);
  const month = view.getUint8(offset + 2);
  const day = view.getUint8(offset + 3);
  const hour = view.getUint8(offset + 4);
  const minute = view.getUint8(offset + 5);
  const second = view.getUint8(offset + 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}Z`;
}

export function encodeTimestamp(iso: string): number[] {
  const date = new Date(iso);
  const out = new DataView(new ArrayBuffer(7));
  out.setUint16(0, date.getUTCFullYear(), true);
  out.setUint8(2, date.getUTCMonth() + 1);
  out.setUint8(3, date.getUTCDate());
  out.setUint8(4, date.getUTCHours());
  out.setUint8(5, date.getUTCMinutes());
  out.setUint8(6, date.getUTCSeconds());
  return [...new Uint8Array(out.buffer)];
}

export function parseHeartRate(view: DataView): HeartRateReading | null {
  if (view.byteLength < 2) return null;
  const flags = view.getUint8(0);
  const wide = (flags & 0x01) !== 0;
  let offset = 1;
  const need = offset + (wide ? 2 : 1);
  if (view.byteLength < need) return null;
  const value = wide ? view.getUint16(offset, true) : view.getUint8(offset);
  offset += wide ? 2 : 1;
  let energyExpendedKj: number | null = null;
  if ((flags & 0x08) !== 0) {
    if (view.byteLength < offset + 2) return null;
    energyExpendedKj = view.getUint16(offset, true);
  }
  return { metric: "heart_rate", value, unit: "bpm", energyExpendedKj };
}

export function parseBloodPressure(view: DataView): BloodPressureReading | null {
  if (view.byteLength < 7) return null;
  const flags = view.getUint8(0);
  const kpa = (flags & 0x01) !== 0;
  const systolic = decodeSfloat(view, 1);
  const diastolic = decodeSfloat(view, 3);
  if (systolic === null || diastolic === null) return null;
  let offset = 7;
  let measuredAt: string | null = null;
  if ((flags & 0x02) !== 0) {
    if (view.byteLength < offset + 7) return null;
    measuredAt = decodeTimestamp(view, offset);
    offset += 7;
  }
  let pulseRate: number | null = null;
  if ((flags & 0x04) !== 0) {
    if (view.byteLength < offset + 2) return null;
    pulseRate = decodeSfloat(view, offset);
  }
  const toMmHg = (v: number) => (kpa ? v * 7.500_616_83 : v);
  return {
    systolic: { metric: "blood_pressure_systolic", value: round1(toMmHg(systolic)), unit: "mmHg" },
    diastolic: { metric: "blood_pressure_diastolic", value: round1(toMmHg(diastolic)), unit: "mmHg" },
    pulseRate,
    measuredAt,
  };
}

export function parseTemperature(view: DataView): TemperatureReading | null {
  if (view.byteLength < 5) return null;
  const flags = view.getUint8(0);
  const fahrenheit = (flags & 0x01) !== 0;
  const raw = decodeFloatBits(view.getUint32(1, true));
  if (raw === null) return null;
  const celsius = fahrenheit ? ((raw - 32) * 5) / 9 : raw;
  return { metric: "temperature_c", value: Math.round(celsius * 100) / 100, unit: "°C" };
}

export function parseGlucose(view: DataView): GlucoseReading | null {
  if (view.byteLength < 10) return null;
  const flags = view.getUint8(0);
  const sequenceNumber = view.getUint16(1, true);
  const baseTime = decodeTimestamp(view, 3);
  let offset = 10;
  let timeOffsetMinutes = 0;
  if ((flags & 0x01) !== 0) {
    if (view.byteLength < offset + 2) return null;
    timeOffsetMinutes = view.getInt16(offset, true);
    offset += 2;
  }
  if ((flags & 0x02) === 0) return null;
  if (view.byteLength < offset + 3) return null;
  const concentration = decodeSfloat(view, offset);
  if (concentration === null) return null;
  const molPerLitre = (flags & 0x04) !== 0;
  const mgPerDl = molPerLitre ? concentration * MGDL_PER_MOLL : concentration * 100_000;
  const measuredAt = new Date(Date.parse(baseTime) + timeOffsetMinutes * 60_000).toISOString();
  return {
    metric: "blood_glucose",
    value: Math.round(mgPerDl * 100) / 100,
    unit: "mg/dL",
    sequenceNumber,
    measuredAt: measuredAt.replace(/\.\d{3}Z$/, "Z"),
  };
}

export function parsePulseOximeter(view: DataView): PulseOximeterReading | null {
  if (view.byteLength < 5) return null;
  const flags = view.getUint8(0);
  const spo2 = decodeSfloat(view, 1);
  if (spo2 === null) return null;
  const pulse = decodeSfloat(view, 3);
  const offset = 5;
  let measuredAt: string | null = null;
  if ((flags & 0x01) !== 0) {
    if (view.byteLength < offset + 7) return null;
    measuredAt = decodeTimestamp(view, offset);
  }
  return {
    spo2: { metric: "oxygen_saturation", value: Math.round(spo2 * 100) / 100, unit: "%" },
    pulseRate: pulse === null ? null : { metric: "heart_rate", value: Math.round(pulse), unit: "bpm" },
    measuredAt,
  };
}

export function parseWeight(view: DataView): WeightReading | null {
  if (view.byteLength < 3) return null;
  const flags = view.getUint8(0);
  const imperial = (flags & 0x01) !== 0;
  const raw = view.getUint16(1, true);
  if (raw === 0xffff) return null;
  const kg = imperial ? raw * 0.01 * 0.453_592_37 : raw * 0.005;
  const offset = 3;
  let measuredAt: string | null = null;
  if ((flags & 0x02) !== 0) {
    if (view.byteLength < offset + 7) return null;
    measuredAt = decodeTimestamp(view, offset);
  }
  return { metric: "body_mass", value: Math.round(kg * 100) / 100, unit: "kg", measuredAt };
}

export function downsamplePerMinute<T extends { at: string }>(readings: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const reading of [...readings].sort((a, b) => (a.at < b.at ? -1 : 1))) {
    const minute = reading.at.slice(0, 16);
    if (seen.has(minute)) continue;
    seen.add(minute);
    kept.push(reading);
  }
  return kept;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
