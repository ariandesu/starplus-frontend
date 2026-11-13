"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OutboxItem } from "@/lib/db";
import { deviceDb, profileDb } from "@/lib/db";
import type { Measurement, Report } from "@starplus/core";
import { onSynced, requestOutboxSync } from "@/lib/outbox-sync";
import { ownReportTitle } from "@/lib/report-title";
import { CAREER_LIMIT_MSV, summarizeRadiation } from "@/lib/radiation-summary";
import { summarizeFitness } from "@/lib/fitness-summary";
import { hasActiveSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

async function loadView(crewId: string) {
  const db = await deviceDb();
  const mine = (await db.getAll("outbox")).filter((item) => item.crew_id === crewId || item.crew_id === "");
  const emergencyWaiting = mine.filter(
    (item) => item.kind === "report" && (item.payload as Report).kind === "emergency" && item.state !== "failed"
  ).length;
  let delivered: Report[] = [];
  let measurements: Measurement[] = [];
  if (crewId) {
    try {
      const pdb = await profileDb(crewId);
      const reports = await pdb.getAll("reports");
      const pendingIds = new Set(mine.map((item) => item.client_id));
      delivered = reports.filter((report) => !pendingIds.has(report.client_id));
      measurements = await pdb.getAll("measurements");
    } catch {
      delivered = [];
      measurements = [];
    }
  }
  return { mine, delivered, emergencyWaiting, measurements };
}

function ReportsView() {
  const session = useActiveCrew();
  const { crewId } = session;
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [delivered, setDelivered] = useState<Report[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [emergencyWaiting, setEmergencyWaiting] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);
  const [demoPaused, setDemoPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const view = await loadView(crewId ?? "");
    setPending(view.mine);
    setDelivered(view.delivered);
    setMeasurements(view.measurements);
    setEmergencyWaiting(view.emergencyWaiting);
    setHasSession(await hasActiveSession());
    setChecked(true);
  }, [crewId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
      const db = await deviceDb();
      if (cancelled) return;
      setDemoPaused((await db.get("settings", "demo_mode"))?.value === "true");
    })().catch(() => undefined);
    const offSynced = onSynced(() => {
      void refresh().catch(() => undefined);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      offSynced();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function sendNow() {
    setBusy(true);
    try {
      await requestOutboxSync({ force: true });
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} heading="Reports" intro="Log in to send reports." />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      {emergencyWaiting > 0 && (
        <p role="status" className="mt-2 rounded-lg bg-status-watch-bg px-3 py-2 text-sm text-status-watch-fg">
          {hasSession
            ? "1 emergency report waiting — sending when the link is up."
            : "1 emergency report waiting — log in to send it."}
        </p>
      )}
      {demoPaused && (
        <p role="status" className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Sending paused in demo mode.
        </p>
      )}
      <div className="mt-4">
        <button
          type="button"
          onClick={sendNow}
          disabled={busy}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Send now
        </button>
      </div>
      <h2 className="mt-6 font-semibold text-foreground">Queued and sending</h2>
      {pending.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Nothing waiting.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {pending.map((item) => (
            <li key={item.client_id} className="rounded-xl border border-border p-3 text-sm">
              <span className="font-semibold">{item.kind}</span> · {item.state}
              {item.error && <span className="text-danger"> · {item.error}</span>}
              <span className="block text-xs text-muted-foreground">{item.client_id.slice(0, 8)}</span>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-6 font-semibold text-foreground">Delivered</h2>
      {delivered.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">Nothing delivered yet.</p>
      ) : (
        <ul aria-label="Delivered reports" className="mt-2 space-y-2">
          {delivered.map((report) => (
            <li key={report.client_id} className="rounded-xl border border-border p-3 text-sm">
              <span className="font-semibold">
                {ownReportTitle(report.kind, report.received_at || report.created_at, report.status)}
              </span>
              {report.summary_text && (
                <span className="block text-xs text-muted-foreground">{report.summary_text}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-6 font-semibold text-foreground">Radiation report</h2>
      {(() => {
        const summary = summarizeRadiation(measurements);
        if (summary.readingCount === 0) {
          return <p className="mt-1 text-sm text-muted-foreground">No dosimeter readings logged yet.</p>;
        }
        return (
          <div className="mt-2 rounded-xl border border-border p-3 text-sm">
            <p>
              <span className="font-semibold">{summary.totalMsv.toFixed(1)} mSv logged</span> —{" "}
              {summary.percentOfCareerLimit.toFixed(1)}% of the {CAREER_LIMIT_MSV} mSv career limit.
            </p>
            {summary.milestone > 0 && (
              <p role="status" className="mt-2 rounded-lg bg-status-watch-bg px-3 py-2 text-status-watch-fg">
                Logged exposure has reached {summary.milestone}% of the career limit. Review the
                radiation guidance with mission control.
              </p>
            )}
            <ul aria-label="Daily logged dose" className="mt-2 space-y-1 text-xs text-muted-foreground">
              {summary.days.map((day) => (
                <li key={day.date}>
                  {day.date}: {day.mSv.toFixed(1)} mSv
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Source: NASA-STD-3001 Vol. 1 Rev. B.{" "}
              <Link className="underline" href="/hazards">
                Radiation hazard guidance
              </Link>
            </p>
          </div>
        );
      })()}
      <h2 className="mt-6 font-semibold text-foreground">Fitness report</h2>
      {(() => {
        const fitness = summarizeFitness(measurements);
        if (fitness.checkinDays7d === 0) {
          return <p className="mt-1 text-sm text-muted-foreground">No check-ins in the last 7 days.</p>;
        }
        return (
          <div className="mt-2 rounded-xl border border-border p-3 text-sm">
            <p>
              <span className="font-semibold">{fitness.activeMinutes7d} active minutes</span> in the
              last 7 days ({fitness.checkinDays7d} of 7 days with a check-in).
            </p>
            {fitness.activeDays.length > 0 && (
              <ul aria-label="Daily active minutes" className="mt-2 space-y-1 text-xs text-muted-foreground">
                {fitness.activeDays.map((day) => (
                  <li key={day.date}>
                    {day.date}: {day.minutes} min
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {fitness.avgSleep7d !== null
                ? `Average sleep ${fitness.avgSleep7d.toFixed(1)} h over ${fitness.sleepNights} ${fitness.sleepNights === 1 ? "night" : "nights"}.`
                : "No sleep logged in the last 7 days."}{" "}
              {fitness.latestMassKg !== null
                ? `Latest body mass ${fitness.latestMassKg} kg${fitness.massDelta30dKg !== null ? ` (${fitness.massDelta30dKg > 0 ? "+" : ""}${fitness.massDelta30dKg.toFixed(1)} kg in 30 days)` : ""}.`
                : "No body mass logged."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Totals of logged readings; activity and mass are baseline-scored with no published
              fitness limits.{" "}
              <Link className="underline" href="/progress">
                Today&apos;s readiness
              </Link>
            </p>
          </div>
        );
      })()}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ReportsView />
    </Suspense>
  );
}
