"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ackReport, getCrewRoster, getReports, type RosterRow } from "@/lib/api";
import { readSurgeonCache, writeSurgeonCache } from "@/lib/surgeon-cache";
import { CrewBoard } from "@/components/surgeon/crew-board";
import { CrewDetail, type DetailReport } from "@/components/surgeon/crew-detail";
import { useSurgeonSession } from "@/components/surgeon/use-surgeon";

function CrewPageView() {
  const session = useSurgeonSession();
  const { crewReady } = session;
  const params = useSearchParams();
  const crewParam = params.get("id") ?? "";
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [reports, setReports] = useState<DetailReport[]>([]);
  const [ready, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.session) return;
    try {
      const [roster, inbox] = await Promise.all([
        getCrewRoster(session.session.token),
        getReports(session.session.token, null, "desc"),
      ]);
      setRows(roster.crew);
      setReports(inbox.reports as DetailReport[]);
      const stamp = new Date().toISOString();
      setUpdatedAt(new Date(stamp).toUTCString());
      await writeSurgeonCache("roster", roster.crew);
      await writeSurgeonCache("reports", inbox.reports);
    } catch {
      const cachedRoster = await readSurgeonCache<RosterRow[]>("roster");
      const cachedReports = await readSurgeonCache<DetailReport[]>("reports");
      if (cachedRoster) {
        setRows(cachedRoster.data);
        setUpdatedAt(new Date(cachedRoster.updatedAt).toUTCString());
      }
      if (cachedReports) setReports(cachedReports.data);
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
    await ackReport(session.session.token, clientId);
    await refresh();
  }

  if (!crewReady || !ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!session.crewId || !session.allowed || !session.session) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Crew</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This view needs a flight medical officer or mission control login.{" "}
          <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=surgeon" className="text-accent underline">Try the demo</Link>
        </p>
      </div>
    );
  }

  if (crewParam) {
    const name = rows.find((row) => row.crew_id === crewParam)?.name ?? crewParam;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <CrewDetail
          token={session.session.token}
          crewId={crewParam}
          crewName={name}
          reports={reports}
          onAcknowledge={acknowledge}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Crew</h1>
      <CrewBoard rows={rows} updatedAt={updatedAt} />
    </div>
  );
}

export default function SurgeonCrewPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <CrewPageView />
    </Suspense>
  );
}
