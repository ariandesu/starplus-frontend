"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { OutboxItem } from "@/lib/db";
import { deviceDb, profileDb } from "@/lib/db";
import type { Report } from "@starplus/core";
import { flush } from "@/lib/outbox";

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
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [delivered, setDelivered] = useState<Report[]>([]);
  const [emergencyWaiting, setEmergencyWaiting] = useState(0);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const view = await loadView(crewId);
    setPending(view.mine);
    setDelivered(view.delivered);
    setEmergencyWaiting(view.emergencyWaiting);
  }

  useEffect(() => {
    (async () => {
      const view = await loadView(crewId);
      setPending(view.mine);
      setDelivered(view.delivered);
      setEmergencyWaiting(view.emergencyWaiting);
    })().catch(() => undefined);
  }, [crewId]);

  async function sendNow() {
    setBusy(true);
    try {
      await flush();
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      {emergencyWaiting > 0 && (
        <p role="status" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          1 emergency report waiting — log in to send it.
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
        <ul className="mt-2 space-y-2">
          {delivered.map((report) => (
            <li key={report.client_id} className="rounded-xl border border-border p-3 text-sm">
              <span className="font-semibold">{report.kind}</span> · delivered
              <span className="block text-xs text-muted-foreground">{report.client_id.slice(0, 8)}</span>
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
