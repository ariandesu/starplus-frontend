"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOG, type Measurement, type Result } from "@starplus/core";
import { Citation } from "@/components/citation";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getCrewMeasurements, getCrewResults } from "@/lib/api";
import { getKbEntry, reasonText } from "@/lib/kb";
import { inboxTitle, shortDate } from "@/lib/report-title";
import { sortVitals } from "@/lib/vital-order";
import { buildSeries, type MetricSeries } from "@/lib/vital-series";
import { readSurgeonCache, writeSurgeonCache } from "@/lib/surgeon-cache";
import { ReportPhotos, type PhotoReport } from "./report-photos";

function parseResult(row: unknown): Result | null {
  const record = row as Record<string, unknown>;
  try {
    const perMeasure = typeof record.per_measure_json === "string" ? JSON.parse(record.per_measure_json) : [];
    const advice =
      typeof record.model_advice_json === "string" && record.model_advice_json
        ? JSON.parse(record.model_advice_json)
        : null;
    return { ...(record as unknown as Result), per_measure: perMeasure, model_advice: advice };
  } catch {
    return null;
  }
}

export interface DetailReport extends PhotoReport {
  kind: string;
  submitted_by: string;
  subject_crew_id: string | null;
  received_at: string;
  created_at: string;
  summary_text: string | null;
  status: string;
}

function seriesFor(records: Measurement[]): MetricSeries[] {
  const now = Date.now();
  const codes = [...new Set(records.map((r) => r.metric))];
  const ordered = sortVitals(codes.map((code) => ({ metric: code, status: "nominal" }))).map(
    (entry) => entry.metric
  );
  return ordered
    .map((code) => buildSeries(records, code, now))
    .filter((entry) => entry !== null);
}

export function CrewDetail({
  token,
  crewId,
  crewName,
  reports,
  onAcknowledge,
}: {
  token: string;
  crewId: string;
  crewName: string;
  reports: DetailReport[];
  onAcknowledge: (clientId: string) => Promise<void> | void;
}) {
  const [results, setResults] = useState<Result[]>([]);
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetchedResults: Result[] = [];
        let cursor: string | null = null;
        for (let page = 0; page < 20; page++) {
          const body = await getCrewResults(token, crewId, cursor);
          for (const item of body.results) {
            const parsed = parseResult(item);
            if (parsed) fetchedResults.push(parsed);
          }
          cursor = body.cursor;
          if (!cursor) break;
        }
        const fetchedRecords: Measurement[] = [];
        cursor = null;
        for (let page = 0; page < 20; page++) {
          const body = await getCrewMeasurements(token, crewId, cursor);
          for (const item of body.measurements) fetchedRecords.push(item as Measurement);
          cursor = body.cursor;
          if (!cursor) break;
        }
        if (cancelled) return;
        setResults(fetchedResults.sort((a, b) => (a.assessed_at < b.assessed_at ? -1 : 1)));
        setSeries(seriesFor(fetchedRecords));
        setUpdatedAt(new Date().toLocaleString());
        await writeSurgeonCache(`detail:${crewId}`, { results: fetchedResults, records: fetchedRecords });
      } catch {
        if (cancelled) return;
        const cached = await readSurgeonCache<{ results: Result[]; records: Measurement[] }>(`detail:${crewId}`);
        if (cached) {
          setResults(cached.data.results);
          setSeries(seriesFor(cached.data.records));
          setUpdatedAt(new Date(cached.updatedAt).toLocaleString());
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, crewId]);

  if (!ready) return <p className="mt-4 text-sm text-muted">Loading…</p>;

  const latest = results.length > 0 ? results[results.length - 1] : null;
  const mine = reports.filter((report) => report.submitted_by === crewId || report.subject_crew_id === crewId);

  async function acknowledge(clientId: string) {
    setBusy(clientId);
    try {
      await onAcknowledge(clientId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Link
        href="/surgeon/crew"
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring"
      >
        All crew
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[1.75rem] font-bold tracking-tight">{crewName}</h1>
        {latest && <StatusPill status={latest.overall_status} />}
      </div>
      {updatedAt && <p className="mt-1 text-xs text-muted">Last updated {updatedAt}</p>}

      {latest && (
        <section aria-label="Latest measures" className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Latest measures</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortVitals(latest.per_measure).map((entry) => {
              const measure = CATALOG.measures.find((m) => m.code === entry.metric);
              const kb = measure ? getKbEntry(measure.guidance_key) : null;
              const baseline = entry.values.baseline_mean;
              return (
                <div key={entry.metric} className="flex flex-col gap-2">
                  <MetricTile
                    eyebrow={measure ? measure.body_system.replace(/_/g, " ") : ""}
                    label={measure?.label ?? entry.metric}
                    value={entry.values.value === null ? "—" : String(entry.values.value)}
                    unit={entry.values.unit}
                    status={entry.status}
                    zScore={entry.values.z_score}
                    baselineText={
                      baseline === null
                        ? "No baseline yet"
                        : `Baseline ${baseline.toFixed(1)} (n=${entry.values.baseline_n})`
                    }
                    dateText={shortDate(latest.assessed_at)}
                  />
                  <p className="text-sm text-foreground">{reasonText(entry.reason_code)}</p>
                  {kb && (
                    <Citation
                      source={
                        kb.citations[0]
                          ? `${kb.citations[0].title} — ${kb.citations[0].publisher}, ${kb.citations[0].year}`
                          : ""
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {series.length > 0 && (
        <section aria-label="Trend charts" className="mt-6">
          <h2 className="text-lg font-semibold text-foreground">Trends</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {series.map((entry) => (
              <VitalChart
                key={entry.code}
                title={entry.label}
                data={entry.points}
                unit={entry.unit}
                baselineLabel={entry.baselineLabel}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Result timeline" className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
        <Card className="mt-3 p-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted">No results yet.</p>
          ) : (
            <ol className="space-y-2">
              {[...results].reverse().map((result) => (
                <li
                  key={result.client_id}
                  className="flex min-h-11 items-center gap-3 border-b border-border pb-2 last:border-0 last:pb-0"
                >
                  <StatusPill status={result.overall_status} />
                  <span className="text-sm text-muted">{new Date(result.assessed_at).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      <section aria-label="Crew reports" className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        {mine.length === 0 ? (
          <Card className="mt-3 p-4">
            <p className="text-sm text-muted">No reports for {crewName} yet.</p>
          </Card>
        ) : (
          <div className="mt-3 space-y-3">
            {mine.map((report) => (
              <Card key={report.client_id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-foreground">
                    {inboxTitle(report.kind, crewName, report.received_at || report.created_at)}
                  </p>
                  <span className="text-xs text-muted">{report.status}</span>
                </div>
                {report.summary_text && <p className="mt-1 text-sm text-foreground">{report.summary_text}</p>}
                <ReportPhotos token={token} report={report} />
                {report.status !== "acknowledged" && (
                  <button
                    type="button"
                    disabled={busy === report.client_id}
                    onClick={() => void acknowledge(report.client_id)}
                    className="mt-3 min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
