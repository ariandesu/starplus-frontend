"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ackReport, getCrewRoster, getReports, type RosterRow } from "@/lib/api";
import { readSurgeonCache, writeSurgeonCache } from "@/lib/surgeon-cache";
import { CrewBoard } from "@/components/surgeon/crew-board";
import { ContinueAsButtons } from "@/components/continue-as";
import { ReportsInbox, type InboxReport } from "@/components/surgeon/reports-inbox";
import { useSurgeonSession } from "@/components/surgeon/use-surgeon";

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

  if (!crewReady || !ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!session.crewId || !session.allowed || !session.session) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Flight surgeon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This view needs a flight medical officer or mission control login.{" "}
          <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=surgeon" className="text-accent underline">Try the demo</Link>
        </p>
        <ContinueAsButtons candidates={candidates} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Flight surgeon</h1>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
      )}
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
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <SurgeonView />
    </Suspense>
  );
}
