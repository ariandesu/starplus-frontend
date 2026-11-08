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
  unit: "degC";
}

export interface GlucoseReading {
  metric: "blood_glucose";
  value: number;
  unit: "mmol/L";
  sequenceNumber: number;
  measuredAt: string;
}

export interface PulseOximeterReading {
  spo2: { metric: "oxygen_saturation"; value: number; unit: "%" };
  pulseRate: { metric: "heart_rate"; value: number; unit: "bpm" };
  measuredAt: string | null;
}

export interface WeightReading {
  metric: "body_mass";
  value: number;
  unit: "kg";
  measuredAt: string | null;
}

export function decodeSfloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  let mantissa = raw & 0x0fff;
  if (mantissa & 0x0800) mantissa -= 0x1000;
  let exponent = (raw >> 12) & 0x000f;
  if (exponent & 0x08) exponent -= 0x10;
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
    offset += 2;
  }
  return { metric: "heart_rate", value, unit: "bpm", energyExpendedKj };
}

export function parseBloodPressure(view: DataView): BloodPressureReading | null {
  if (view.byteLength < 7) return null;
  const flags = view.getUint8(0);
  const kpa = (flags & 0x01) !== 0;
  const systolic = decodeSfloat(view, 1);
  const diastolic = decodeSfloat(view, 3);
  decodeSfloat(view, 5);
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
  const raw = view.getUint32(1, true);
  const bytes = new DataView(new ArrayBuffer(4));
  bytes.setUint32(0, raw, true);
  let mantissa = bytes.getUint8(0) | (bytes.getUint8(1) << 8) | (bytes.getUint8(2) << 16);
  if (mantissa & 0x800000) mantissa -= 0x1000000;
  const exponent = bytes.getInt8(3);
  const celsius = fahrenheit ? ((mantissa * 10 ** exponent - 32) * 5) / 9 : mantissa * 10 ** exponent;
  return { metric: "temperature_c", value: Math.round(celsius * 100) / 100, unit: "degC" };
}

export function parseGlucose(view: DataView): GlucoseReading | null {
  if (view.byteLength < 10) return null;
  const flags = view.getUint8(0);
  const sequenceNumber = view.getUint16(1, true);
  const measuredAt = decodeTimestamp(view, 3);
  let offset = 10;
  if ((flags & 0x01) !== 0) {
    if (view.byteLength < offset + 2) return null;
    offset += 2;
  }
  if ((flags & 0x02) === 0) return null;
  if (view.byteLength < offset + 3) return null;
  const concentration = decodeSfloat(view, offset);
  const molPerLitre = (flags & 0x04) !== 0;
  const value = molPerLitre ? concentration * 1000 : concentration * 100_000;
  return {
    metric: "blood_glucose",
    value: Math.round(value * 100) / 100,
    unit: "mmol/L",
    sequenceNumber,
    measuredAt,
  };
}

export function parsePulseOximeter(view: DataView): PulseOximeterReading | null {
  if (view.byteLength < 5) return null;
  const flags = view.getUint8(0);
  const spo2 = decodeSfloat(view, 1);
  const pulseRate = decodeSfloat(view, 3);
  const offset = 5;
  let measuredAt: string | null = null;
  if ((flags & 0x01) !== 0) {
    if (view.byteLength < offset + 7) return null;
    measuredAt = decodeTimestamp(view, offset);
  }
  return {
    spo2: { metric: "oxygen_saturation", value: Math.round(spo2 * 100) / 100, unit: "%" },
    pulseRate: { metric: "heart_rate", value: Math.round(pulseRate), unit: "bpm" },
    measuredAt,
  };
}

export function parseWeight(view: DataView): WeightReading | null {
  if (view.byteLength < 3) return null;
  const flags = view.getUint8(0);
  const imperial = (flags & 0x01) !== 0;
  const raw = view.getUint16(1, true);
  const kg = imperial ? raw * 0.01 * 0.453_592_37 : raw * 0.005;
  const offset = 3;
  let measuredAt: string | null = null;
  if ((flags & 0x02) !== 0) {
    if (view.byteLength < offset + 7) return null;
    measuredAt = decodeTimestamp(view, offset);
  }
  return { metric: "body_mass", value: Math.round(kg * 100) / 100, unit: "kg", measuredAt };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
