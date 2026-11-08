"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CATALOG, assess, type Measurement, type Result } from "@starplus/core";
import { Citation, StatusTone } from "@/components/citation";
import { ModelView } from "@/components/model-view";
import { profileDb } from "@/lib/db";
import { enqueueResult } from "@/lib/outbox";
import { getExplanation, getKbEntry, citeLabel } from "@/lib/kb";
import type { KbEntry } from "@starplus/core";
import { useActiveCrew } from "@/lib/use-active-crew";

function ExplainMore({ entry, metric }: { entry: KbEntry; metric: string }) {
  const [open, setOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null | undefined>(undefined);
  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (aiText === undefined) setAiText(await getExplanation(entry.id, "simple"));
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void toggle()}
        className="text-sm font-medium text-accent underline"
      >
        {open ? "Hide the simple explanation" : "Explain more simply"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-muted/40 p-3 text-sm text-foreground">
          {(aiText ?? entry.text.join("\n")).split("\n").map((line, i) => (
            <p key={`${metric}-${i}`} className="mt-1 first:mt-0">
              {line}
            </p>
          ))}
          <Citation source={citeLabel(entry.citations[0])} className="mt-2" />
          <p className="mt-1 text-xs text-muted-foreground">
            {aiText ? "AI-written, reviewed by the developer against the cited source." : "From the cited source."}
          </p>
        </div>
      )}
    </div>
  );
}

function ResultView() {
  const router = useRouter();
  const params = useSearchParams();
  const { crewId, ready: crewReady } = useActiveCrew();
  const resultId = params.get("result") ?? "";
  const [result, setResult] = useState<Result | null>(null);
  const [records, setRecords] = useState<Measurement[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function confirmEstimate(clientId: string, phase: string) {
    if (!crewId || confirming) return;
    setConfirming(clientId);
    try {
      const db = await profileDb(crewId);
      const record = await db.get("measurements", clientId);
      if (!record) return;
      await db.put("measurements", { ...record, confirmed_by_user: 1 as const });
      const history = await db.getAll("measurements");
      const next = await assess(history, { now: Date.now(), phase: phase as "preflight" | "inflight" | "surface" | "postflight", model: null });
      await enqueueResult(crewId, next);
      router.push(`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(next.client_id)}`);
    } finally {
      setConfirming(null);
    }
  }

  useEffect(() => {
    if (!crewReady) return;
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
  }, [crewId, crewReady, resultId]);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to see a result. <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=astronaut" className="text-accent underline">Try the demo</Link>
        </p>
      </div>
    );
  }
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
                <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p>
                    Estimated and abnormal: re-measure with a device, or confirm it stands and tell
                    the crew medical officer.
                  </p>
                  <button
                    type="button"
                    disabled={confirming === entry.values.client_id}
                    onClick={() => confirmEstimate(entry.values.client_id, record?.phase ?? "inflight")}
                    className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Confirm reading stands
                  </button>
                </div>
              )}
              {entry.values.refuted.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Refuted estimate kept for the record ({entry.values.refuted.length}); it does not
                  affect the baseline.
                </p>
              )}
              {kb && <ExplainMore entry={kb} metric={entry.metric} />}
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
