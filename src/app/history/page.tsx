"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { CATALOG } from "@starplus/core";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { buildSeries, type MetricSeries } from "@/lib/vital-series";
import { profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";

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

function HistoryView() {
  const { crewId, ready: crewReady } = useActiveCrew();
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!crewReady) return;
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
  }, [crewId, crewReady]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to see history. <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=astronaut" className="text-accent underline">Try the demo</Link>
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
