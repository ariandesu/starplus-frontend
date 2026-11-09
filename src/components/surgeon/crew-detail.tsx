"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOG, type Measurement, type Result } from "@starplus/core";
import { Citation, StatusTone } from "@/components/citation";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { getCrewMeasurements, getCrewResults } from "@/lib/api";
import { getKbEntry, reasonText } from "@/lib/kb";
import { inboxTitle } from "@/lib/report-title";
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
  return codes
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
        setUpdatedAt(new Date().toUTCString());
        await writeSurgeonCache(`detail:${crewId}`, { results: fetchedResults, records: fetchedRecords });
      } catch {
        if (cancelled) return;
        const cached = await readSurgeonCache<{ results: Result[]; records: Measurement[] }>(`detail:${crewId}`);
        if (cached) {
          setResults(cached.data.results);
          setSeries(seriesFor(cached.data.records));
          setUpdatedAt(new Date(cached.updatedAt).toUTCString());
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, crewId]);

  if (!ready) return <p className="mt-4 text-sm text-muted-foreground">Loading…</p>;

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
      <Link href="/surgeon/crew" className="text-sm text-accent underline">
        All crew
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{crewName}</h1>
      {updatedAt && <p className="mt-1 text-xs text-muted-foreground">Last updated {updatedAt}</p>}

      <section aria-label="Result timeline" className="mt-4">
        <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
        {results.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No results yet.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {[...results].reverse().map((result) => (
              <li key={result.client_id} className="flex items-center gap-2 text-sm">
                <StatusTone status={result.overall_status} />
                <span className="text-foreground">{result.overall_status}</span>
                <span className="text-muted-foreground">{new Date(result.assessed_at).toUTCString()}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {latest && (
        <section aria-label="Latest measures" className="mt-4">
          <h2 className="text-lg font-semibold text-foreground">Latest measures</h2>
          <ul className="mt-2 space-y-3">
            {latest.per_measure.map((entry) => {
              const measure = CATALOG.measures.find((m) => m.code === entry.metric);
              const kb = measure ? getKbEntry(measure.guidance_key) : null;
              return (
                <li key={entry.metric} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{measure?.label ?? entry.metric}</p>
                    <StatusTone status={entry.status} />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {String(entry.values.value)} {entry.values.unit} — {reasonText(entry.reason_code)}
                  </p>
                  {entry.values.baseline_mean !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Baseline {entry.values.baseline_mean.toFixed(1)} (n={entry.values.baseline_n})
                    </p>
                  )}
                  {kb && <Citation source={kb.citations[0] ? `${kb.citations[0].title} — ${kb.citations[0].publisher}, ${kb.citations[0].year}` : ""} className="mt-1" />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {series.length > 0 && (
        <section aria-label="Trend charts" className="mt-4">
          <h2 className="text-lg font-semibold text-foreground">Trends</h2>
          <div className="mt-2 space-y-4">
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

      <section aria-label="Crew reports" className="mt-4">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        {mine.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No reports for {crewName} yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {mine.map((report) => (
              <li key={report.client_id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {inboxTitle(report.kind, crewName, report.received_at || report.created_at)}
                  </p>
                  <span className="text-xs text-muted-foreground">{report.status}</span>
                </div>
                {report.summary_text && <p className="mt-1 text-sm text-foreground">{report.summary_text}</p>}
                <ReportPhotos token={token} report={report} />
                {report.status !== "acknowledged" && (
                  <button
                    type="button"
                    disabled={busy === report.client_id}
                    onClick={() => void acknowledge(report.client_id)}
                    className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                  >
                    Acknowledge
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
