"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CATALOG, assess, type Measurement, type PerMeasureResult, type Result } from "@starplus/core";
import { Citation, StatusTone } from "@/components/citation";
import { AskConsult } from "@/components/ask-consult";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { ModelView } from "@/components/model-view";
import { WhatToDo } from "@/components/what-to-do";
import { profileDb, deviceDb } from "@/lib/db";
import { formatMetricValue } from "@/lib/display";
import { enqueueResult } from "@/lib/outbox";
import { getExplanation, getKbEntry, citeLabel, reasonText } from "@/lib/kb";
import { orderResultEntries } from "@/lib/result-advice";
import { computeXp, rankForTotal } from "@/lib/xp";
import { FullCheckCelebration, XpToast } from "@/components/xp-feedback";
import { getSession } from "@/lib/session";
import type { KbEntry } from "@starplus/core";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

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
        className="text-sm font-medium text-accent-strong underline"
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
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const resultId = params.get("result") ?? "";
  const xpParam = Math.max(Number(params.get("xp") ?? 0) || 0, 0);
  const fullParam = params.get("fullcheck") === "1";
  const [result, setResult] = useState<Result | null>(null);
  const [records, setRecords] = useState<Measurement[]>([]);
  const [xpTotal, setXpTotal] = useState<number | null>(null);
  const [toastGone, setToastGone] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [now] = useState(() => Date.now());

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
      if (!crewId) return;
      const db = await profileDb(crewId);
      let stored = resultId ? await db.get("results", resultId) : undefined;
      if (!stored && !resultId) {
        const all = await db.getAll("results");
        stored = all.sort((a, b) => (a.assessed_at < b.assessed_at ? 1 : -1))[0];
      }
      if (!stored) {
        setSettled(true);
        return;
      }
      setResult(stored);
      const measures = await Promise.all(
        stored.per_measure.map((entry) => db.get("measurements", entry.values.client_id))
      );
      setRecords(measures.filter((m): m is Measurement => !!m));
      try {
        const [device, live] = await Promise.all([deviceDb(), getSession(crewId)]);
        const [all, deviceRow] = await Promise.all([
          db.getAll("measurements"),
          device.get("settings", "device_id"),
        ]);
        setXpTotal(
          computeXp(all, stored, {
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            demo: Boolean(live?.demo),
            deviceId: deviceRow?.value ?? null,
            now: Date.now(),
          }).total
        );
      } catch {
        /* the XP toast is decorative; the result stands without it */
      }
      setSettled(true);
    })().catch(() => setSettled(true));
  }, [crewId, crewReady, resultId]);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} heading="Log in to see a result" />;
  }
  if (!result) {
    if (!settled && resultId) {
      return (
        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          <p className="text-sm text-muted-foreground">Loading the result…</p>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          No result yet. <Link href={crewId ? `/check?crew=${encodeURIComponent(crewId)}` : "/check"} className="text-accent-strong underline">Start a self-check</Link>
        </p>
      </div>
    );
  }

  function MeasureCard({ entry }: { entry: PerMeasureResult }) {
    const measure = CATALOG.measures.find((m) => m.code === entry.metric);
    const kb = measure ? getKbEntry(measure.guidance_key) : null;
    const record = records.find((r) => r.client_id === entry.values.client_id);
    return (
      <article className="rounded-tile border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">{measure?.label ?? entry.metric}</h2>
          <StatusTone status={entry.status} />
        </div>
        <p className="mt-1 text-sm text-foreground">
          {formatMetricValue(entry.metric, entry.values.value)} {entry.values.unit} — {reasonText(entry.reason_code)}
        </p>
        <Citation source={measure?.limit_source ?? ""} className="mt-1" />
        {(entry.status === "watch" || entry.status === "critical") && (
          <WhatToDo status={entry.status} value={entry.values.value} measure={measure} kb={kb} />
        )}
        {entry.values.confirm_required && (
          <div className="mt-2 rounded-lg bg-status-watch-bg px-3 py-2 text-sm text-status-watch-fg">
            <p>
              Estimated and abnormal: re-measure with a device, or confirm it stands and tell
              the crew medical officer.
            </p>
            <button
              type="button"
              disabled={confirming === entry.values.client_id}
              onClick={() => confirmEstimate(entry.values.client_id, record?.phase ?? "inflight")}
              className="mt-2 rounded-lg bg-status-watch-fg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
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
        {kb && crewId && (
          <AskConsult crewId={crewId} entryId={kb.id} measureLabel={measure?.label ?? entry.metric} />
        )}
        {record?.is_estimate === 1 && record.confirmed_by_user === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Recorded as an estimate.</p>
        )}
      </article>
    );
  }

  const measuredAtByClient = new Map(records.map((record) => [record.client_id, record.measured_at]));
  const { top, folded } = orderResultEntries(
    result.per_measure,
    (entry) => measuredAtByClient.get(entry.values.client_id) ?? null,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    now
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <PageHeader eyebrow="RESULT" title="Your result" />
      {xpParam > 0 && !toastGone && (
        <XpToast amount={xpParam} onDismiss={() => setToastGone(true)} />
      )}
      {fullParam && xpParam > 0 && xpTotal !== null && (
        <FullCheckCelebration
          oldTotal={Math.max(xpTotal - xpParam, 0)}
          newTotal={xpTotal}
          newRank={
            rankForTotal(xpTotal).level > rankForTotal(Math.max(xpTotal - xpParam, 0)).level
              ? rankForTotal(xpTotal).rank
              : null
          }
        />
      )}
      <Card variant="hero" glow={result.overall_status} className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-white/70">
            Overall status
          </p>
          <StatusTone status={result.overall_status} />
        </div>
      </Card>
      <div className="mt-4 space-y-4">
        {top.map((entry) => (
          <MeasureCard key={`${entry.metric}-${entry.values.client_id}`} entry={entry} />
        ))}
        {folded.length > 0 && (
          <details className="rounded-tile border border-border bg-card p-4">
            <summary className="min-h-11 cursor-pointer text-sm font-semibold text-foreground">
              {folded.length} more inside the limits
            </summary>
            <div className="mt-4 space-y-4">
              {folded.map((entry) => (
                <MeasureCard key={`${entry.metric}-${entry.values.client_id}`} entry={entry} />
              ))}
            </div>
          </details>
        )}
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
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          New check
        </Link>
        <Link
          href="/emergency"
          className="rounded-xl bg-danger-fill px-4 py-2 text-sm font-bold text-danger-foreground"
        >
          Emergency
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ResultView />
    </Suspense>
  );
}
