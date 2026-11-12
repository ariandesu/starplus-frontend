"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CATALOG, type Result } from "@starplus/core";
import { StatusTone } from "@/components/citation";
import { PageHeader } from "@/components/dashboard/page-header";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { buildSeries, type MetricSeries } from "@/lib/vital-series";
import { profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

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
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [pastResults, setPastResults] = useState<Result[]>([]);
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
        const stored = await db.getAll("results");
        stored.sort((a, b) => Date.parse(b.assessed_at) - Date.parse(a.assessed_at));
        setPastResults(stored);
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

  if (!ready) return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} heading="History" />;
  }

  const active = MEASURE_FILTERS.find((item) => item.id === filter);
  const codes = active?.codes;
  const visible = !codes ? series : series.filter((entry) => codes.has(entry.code));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader eyebrow="HISTORY" title="History" />
      <p className="mt-1 text-sm text-muted">
        Each chart shows the baseline band beside recent readings. Typical ranges from the
        catalog appear in the self-check form.
      </p>
      <div className="mt-4">
        <SegmentedControl
          ariaLabel="Measure filter"
          value={filter}
          onChange={setFilter}
          options={MEASURE_FILTERS.map((entry) => ({ value: entry.id, label: entry.label }))}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.length === 0 ? (
          <p className="text-sm text-muted">No readings yet.</p>
        ) : (
          visible.map((entry) => (
            <VitalChart
              key={entry.code}
              title={entry.label}
              data={entry.points}
              unit={entry.unit}
              baselineLabel={entry.baselineLabel}
            />
          ))
        )}
      </div>
      {CATALOG.measures.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Measures without enough history show the catalog typical range instead.
        </p>
      )}
      <section aria-label="Past results" className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Past results</h2>
        {pastResults.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No results yet. Finish a self-check to see one here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pastResults.map((result) => (
              <li key={result.client_id}>
                <Link
                  href={`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(result.client_id)}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-tile border border-border bg-card px-4 py-2 focus-ring"
                >
                  <span className="text-sm text-foreground">
                    {new Date(result.assessed_at).toLocaleString()}
                  </span>
                  <StatusTone status={result.overall_status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <HistoryView />
    </Suspense>
  );
}
