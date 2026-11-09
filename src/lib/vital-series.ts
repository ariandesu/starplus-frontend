import { lookupMeasure, sdFloorFor, type Measurement } from "@starplus/core";

export interface SeriesPoint {
  name: string;
  value: number;
  low?: number;
  high?: number;
}

export interface MetricSeries {
  code: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
  baselineLabel?: string;
}

const DAY_MS = 86_400_000;

export function buildSeries(records: Measurement[], code: string, now: number): MetricSeries | null {
  const measure = lookupMeasure(code);
  if (!measure) return null;
  const ordered = records
    .filter((r) => r.metric === code && r.value_num !== null && r.voided === 0)
    .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
  if (ordered.length === 0) return null;
  const baseline = ordered.filter(
    (r) => now - Date.parse(r.measured_at) >= 72 * 3_600_000 && now - Date.parse(r.measured_at) <= 30 * DAY_MS
  );
  let label: string | undefined;
  let low: number | undefined;
  let high: number | undefined;
  if (baseline.length >= 5) {
    const values = baseline.map((r) => r.value_num as number);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const spread = Math.max(sd, sdFloorFor(measure, mean));
    low = mean - 2 * spread;
    high = mean + 2 * spread;
    label = `Baseline band: ${mean.toFixed(1)} ± ${(2 * spread).toFixed(1)} ${measure.unit} (30 days before the last 72 h).`;
  }
  const points = ordered.slice(-30).map((r) => ({
    name: new Date(r.measured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: r.value_num as number,
    low,
    high,
  }));
  return { code, label: measure.label, unit: measure.unit, points, baselineLabel: label };
}
