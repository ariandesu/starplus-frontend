"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CATALOG, type Measurement, type Result } from "@starplus/core";
import { Citation, StatusTone } from "@/components/citation";
import { ModelView } from "@/components/model-view";
import { profileDb } from "@/lib/db";
import { getKbEntry } from "@/lib/kb";

function ResultView() {
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const resultId = params.get("result") ?? "";
  const [result, setResult] = useState<Result | null>(null);
  const [records, setRecords] = useState<Measurement[]>([]);
  const [simpleId, setSimpleId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!crewId || !resultId) return;
      const db = await profileDb(crewId);
      const stored = await db.get("results", resultId);
      if (!stored) return;
      setResult(stored);
      const measures = await Promise.all(
        stored.per_measure.map((entry) => db.get("measurements", entry.values.client_id))
      );
      setRecords(measures.filter((m): m is Measurement => !!m));
    })().catch(() => undefined);
  }, [crewId, resultId]);

  if (!result) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading the result…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Your result</h1>
        <StatusTone status={result.overall_status} />
      </div>
      <div className="mt-4 space-y-4">
        {result.per_measure.map((entry) => {
          const measure = CATALOG.measures.find((m) => m.code === entry.metric);
          const kb = measure ? getKbEntry(measure.guidance_key) : null;
          const record = records.find((r) => r.client_id === entry.values.client_id);
          return (
            <article key={`${entry.metric}-${entry.values.client_id}`} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-foreground">{measure?.label ?? entry.metric}</h2>
                <StatusTone status={entry.status} />
              </div>
              <p className="mt-1 text-sm text-foreground">
                {String(entry.values.value)} {entry.values.unit} — {reasonText(entry.reason_code)}
              </p>
              <Citation source={measure?.limit_source ?? ""} className="mt-1" />
              {entry.values.confirm_required && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Estimated and abnormal: re-measure with a device, or confirm it stands and tell
                  the crew medical officer.
                </p>
              )}
              {entry.values.refuted.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Refuted estimate kept for the record ({entry.values.refuted.length}); it does not
                  affect the baseline.
                </p>
              )}
              {kb && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setSimpleId(simpleId === entry.metric ? null : entry.metric)}
                    className="text-sm font-medium text-accent underline"
                  >
                    {simpleId === entry.metric ? "Hide the simple explanation" : "Explain more simply"}
                  </button>
                  {simpleId === entry.metric && (
                    <div className="mt-2 rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                      {kb.text.map((line, i) => (
                        <p key={i} className="mt-1 first:mt-0">
                          {line}
                        </p>
                      ))}
                      <Citation source={kb.citations[0]?.source ?? ""} className="mt-2" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        AI-written, reviewed by the developer against the cited source.
                      </p>
                    </div>
                  )}
                </div>
              )}
              {record?.is_estimate === 1 && record.confirmed_by_user === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Recorded as an estimate.</p>
              )}
            </article>
          );
        })}
      </div>
      <div className="mt-4">
        <ModelView advice={result.model_advice} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Result {result.client_id.slice(0, 8)} · model {result.model_version} · catalog{" "}
        {result.catalog_version} · {new Date(result.assessed_at).toUTCString()}
      </p>
      <div className="mt-4 flex gap-3">
        <Link
          href={`/check?crew=${encodeURIComponent(crewId)}`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          New check
        </Link>
        <Link
          href="/emergency"
          className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
        >
          Emergency
        </Link>
      </div>
    </div>
  );
}

function reasonText(reason: string): string {
  switch (reason) {
    case "limit_watch":
      return "at or beyond a watch limit";
    case "limit_critical":
      return "at or beyond a critical limit";
    case "baseline_watch":
      return "rising against the personal baseline";
    case "baseline_critical":
      return "rising strongly against the personal baseline";
    case "within_limits":
      return "inside the safety limits";
    case "insufficient_baseline":
      return "not enough history yet — a baseline needs 5 readings older than 3 days";
    case "estimate_abnormal":
      return "estimated and outside the limits — confirm with a device";
    case "refuted_estimate":
      return "an earlier estimate a device reading overruled";
    default:
      return reason;
  }
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ResultView />
    </Suspense>
  );
}
