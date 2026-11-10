"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ackReport, getCrewRoster, getReports, type RosterRow } from "@/lib/api";
import { readSurgeonCache, writeSurgeonCache } from "@/lib/surgeon-cache";
import { Card } from "@/components/ui/card";
import { StatCount } from "@/components/dashboard/stat-count";
import { PageHeader } from "@/components/dashboard/page-header";
import { CrewBoard } from "@/components/surgeon/crew-board";
import { ContinueAsButtons } from "@/components/continue-as";
import { ReportsInbox, type InboxReport } from "@/components/surgeon/reports-inbox";
import { useSurgeonSession } from "@/components/surgeon/use-surgeon";
import { RequireSession } from "@/components/require-session";

function SurgeonView() {
  const session = useSurgeonSession();
  const { crewReady, candidates } = session;
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [reports, setReports] = useState<InboxReport[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.session) return;
    const token = session.session.token;
    try {
      const [roster, inbox] = await Promise.all([
        getCrewRoster(token),
        getReports(token, null, "desc"),
      ]);
      setRows(roster.crew);
      setReports(inbox.reports as InboxReport[]);
      const byId = new Map(roster.crew.map((row) => [row.crew_id, row.name] as const));
      setNames(byId);
      const stamp = new Date().toISOString();
      setUpdatedAt(new Date(stamp).toLocaleString());
      await writeSurgeonCache("roster", roster.crew);
      await writeSurgeonCache("reports", inbox.reports);
    } catch {
      const cachedRoster = await readSurgeonCache<RosterRow[]>("roster");
      const cachedReports = await readSurgeonCache<InboxReport[]>("reports");
      if (cachedRoster) {
        setRows(cachedRoster.data);
        setUpdatedAt(new Date(cachedRoster.updatedAt).toLocaleString());
      }
      if (cachedReports) setReports(cachedReports.data);
      if (cachedRoster) {
        setNames(new Map(cachedRoster.data.map((row) => [row.crew_id, row.name] as const)));
      }
      if (!cachedRoster) setError("Could not load the crew board. Check the link and try again.");
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
    return <RequireSession session={session.state} heading="Flight surgeon" />;
  }
  if (!session.allowed || !session.session) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <PageHeader title="Flight surgeon" />
        <p className="mt-1 text-sm text-muted">
          This view needs a flight medical officer or mission control login.{" "}
          <Link href="/login" className="text-accent-strong underline">Go to login</Link>{" "}
          <Link href="/login?demo=surgeon" className="text-accent-strong underline">Try the demo</Link>
        </p>
        <ContinueAsButtons candidates={candidates} />
      </div>
    );
  }

  const critical = rows.filter((row) => row.overall_status === "critical").length;
  const watch = rows.filter((row) => row.overall_status === "watch").length;
  const openReports = rows.reduce((sum, row) => sum + row.open_reports, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="MISSION MEDICAL"
        title="Flight surgeon"
        actions={updatedAt ? <p className="text-xs text-muted">Last updated {updatedAt}</p> : null}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">{error}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <StatCount value={rows.length} label="Crew" />
        </Card>
        <Card className="p-4">
          <StatCount value={critical} label="Critical" />
        </Card>
        <Card className="p-4">
          <StatCount value={watch} label="Watch" />
        </Card>
        <Card className="p-4">
          <StatCount value={openReports} label="Open reports" />
        </Card>
      </div>
      <CrewBoard rows={rows} updatedAt={updatedAt} />
      <ReportsInbox
        token={session.session.token}
        reports={reports}
        names={names}
        updatedAt={updatedAt}
        onAcknowledge={acknowledge}
      />
    </div>
  );
}

export default function SurgeonPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <SurgeonView />
    </Suspense>
  );
}
