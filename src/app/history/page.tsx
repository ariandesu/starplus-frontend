"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CATALOG, lookupMeasure, sdFloorFor, type Measurement } from "@starplus/core";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { profileDb } from "@/lib/db";

interface SeriesPoint {
  name: string;
  value: number;
  low?: number;
  high?: number;
}

interface MetricSeries {
  code: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
  baselineLabel?: string;
}

const DAY_MS = 86_400_000;

interface MeasureFilter {
  id: string;
  label: string;
  codes: ReadonlySet<string> | null;
}

const MEASURE_FILTERS: MeasureFilter[] = [
  { id: "all", label: "All", codes: null },
  { id: "radiation", label: "Radiation", codes: new Set(["radiation_dose"]) },
  { id: "nutrition", label: "Nutrition", codes: new Set(["calories", "water_intake"]) },
  { id: "exercise", label: "Exercise", codes: new Set(["physical_activity"]) },
];

function buildSeries(records: Measurement[], code: string, now: number): MetricSeries | null {
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

function HistoryView() {
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      try {
        const db = await profileDb(crewId);
        const records = await db.getAll("measurements");
        const now = Date.now();
        const codes = [...new Set(records.map((r) => r.metric))];
        const built: MetricSeries[] = [];
        for (const code of codes) {
          const entry = buildSeries(records, code, now);
          if (entry) built.push(entry);
        }
        setSeries(built);
      } catch {
        setSeries([]);
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to see history. <Link href="/login" className="text-accent underline">Go to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each chart shows the baseline band beside recent readings. Typical ranges from the
        catalog appear in the self-check form.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Measure filter">
        {MEASURE_FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={filter === entry.id}
            onClick={() => setFilter(entry.id)}
            className={`rounded-full border px-3 py-1 text-sm ${filter === entry.id ? "border-foreground font-semibold text-foreground" : "border-border text-muted-foreground"}`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        {(() => {
          const active = MEASURE_FILTERS.find((item) => item.id === filter);
          const codes = active?.codes;
          const visible = !codes ? series : series.filter((entry) => codes.has(entry.code));
          if (visible.length === 0) return <p className="text-sm text-muted-foreground">No readings yet.</p>;
          return visible.map((entry) => (
            <VitalChart
              key={entry.code}
              title={entry.label}
              data={entry.points}
              unit={entry.unit}
              baselineLabel={entry.baselineLabel}
            />
          ));
        })()}
      </div>
      {CATALOG.measures.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Measures without enough history show the catalog typical range instead.
        </p>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <HistoryView />
    </Suspense>
  );
}
