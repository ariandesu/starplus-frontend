"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OutboxItem } from "@/lib/db";
import { deviceDb, profileDb } from "@/lib/db";
import type { Report } from "@starplus/core";
import { onSynced, requestOutboxSync } from "@/lib/outbox-sync";
import { ownReportTitle } from "@/lib/report-title";
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
  if (crewId) {
    try {
      const pdb = await profileDb(crewId);
      const reports = await pdb.getAll("reports");
      const pendingIds = new Set(mine.map((item) => item.client_id));
      delivered = reports.filter((report) => !pendingIds.has(report.client_id));
    } catch {
      delivered = [];
    }
  }
  return { mine, delivered, emergencyWaiting };
}

function ReportsView() {
  const session = useActiveCrew();
  const { crewId } = session;
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [delivered, setDelivered] = useState<Report[]>([]);
  const [emergencyWaiting, setEmergencyWaiting] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [checked, setChecked] = useState(false);
  const [demoPaused, setDemoPaused] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const view = await loadView(crewId ?? "");
    setPending(view.mine);
    setDelivered(view.delivered);
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
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-50"
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
              {item.error && <span className="text-red-700"> · {item.error}</span>}
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
