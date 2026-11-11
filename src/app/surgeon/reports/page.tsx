"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ackReport, getCrewRoster, getReports } from "@/lib/api";
import { readSurgeonCache, writeSurgeonCache } from "@/lib/surgeon-cache";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportsInbox, type InboxReport } from "@/components/surgeon/reports-inbox";
import { useSurgeonSession } from "@/components/surgeon/use-surgeon";
import { RequireSession } from "@/components/require-session";

function SurgeonReportsView() {
  const session = useSurgeonSession();
  const { crewReady } = session;
  const [reports, setReports] = useState<InboxReport[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.session) return;
    try {
      const [roster, inbox] = await Promise.all([
        getCrewRoster(session.session.token),
        getReports(session.session.token, null, "desc"),
      ]);
      setReports(inbox.reports as InboxReport[]);
      const byId = new Map(roster.crew.map((row) => [row.crew_id, row.name] as const));
      setNames(byId);
      const stamp = new Date().toISOString();
      setUpdatedAt(new Date(stamp).toLocaleString());
      await writeSurgeonCache("reports", inbox.reports);
      await writeSurgeonCache("roster", roster.crew);
    } catch {
      const cached = await readSurgeonCache<InboxReport[]>("reports");
      const cachedRoster = await readSurgeonCache<Array<{ crew_id: string; name: string }>>("roster");
      if (cached) {
        setReports(cached.data);
        setUpdatedAt(new Date(cached.updatedAt).toLocaleString());
      }
      if (cachedRoster) setNames(new Map(cachedRoster.data.map((row) => [row.crew_id, row.name] as const)));
      if (!cached) setError("Could not load reports. Check the link and try again.");
    } finally {
      setReady(true);
    }
  }, [session.session]);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!session.session) {
        setReady(true);
        return;
      }
      await refresh();
    })().catch(() => setReady(true));
  }, [crewReady, session.session, refresh]);

  async function acknowledge(clientId: string) {
    if (!session.session) return;
    setError(null);
    try {
      await ackReport(session.session.token, clientId);
      await refresh();
    } catch {
      setError("Acknowledgement failed. Only the flight medical officer can acknowledge.");
    }
  }

  if (!crewReady || !ready) return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;
  if (session.state.status !== "active") {
    return <RequireSession session={session.state} heading="Reports inbox" />;
  }
  if (!session.allowed || !session.session) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <PageHeader title="Reports inbox" />
        <p className="mt-1 text-sm text-muted">
          This view needs a flight medical officer or mission control login.{" "}
          <Link href="/login" className="text-accent-strong underline">Go to login</Link>{" "}
          <Link href="/login?demo=surgeon" className="text-accent-strong underline">Try the demo</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="MISSION MEDICAL"
        title="Reports inbox"
        actions={updatedAt ? <p className="text-xs text-muted">Last updated {updatedAt}</p> : null}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
      )}
      <ReportsInbox
        token={session.session.token}
        reports={reports}
        names={names}
        onAcknowledge={acknowledge}
      />
    </div>
  );
}

export default function SurgeonReportsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <SurgeonReportsView />
    </Suspense>
  );
}
