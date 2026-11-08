"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ackReport, getReports } from "@/lib/api";
import { getSession } from "@/lib/session";

interface ReportRow {
  client_id: string;
  device_id: string;
  submitted_by: string;
  subject_crew_id: string | null;
  subject_label: string | null;
  kind: string;
  created_at: string;
  received_at: string;
  payload_json: string;
  summary_text: string | null;
  status: string;
}

function SurgeonView() {
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      const session = await getSession(crewId);
      if (!session || (session.role !== "flight_medical_officer" && session.role !== "mission_control")) {
        setReady(true);
        return;
      }
      setToken(session.token);
      setAllowed(true);
      try {
        const body = await getReports(session.token);
        setReports(body.reports as ReportRow[]);
      } catch {
        setError("Could not load reports. Check the link and try again.");
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId]);

  async function acknowledge(client_id: string) {
    setError(null);
    try {
      await ackReport(token, client_id);
      const body = await getReports(token);
      setReports(body.reports as ReportRow[]);
    } catch {
      setError("Acknowledgement failed. Only the flight medical officer can acknowledge.");
    }
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId || !allowed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Flight surgeon</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This view needs a flight medical officer or mission control login.{" "}
          <Link href="/login" className="text-accent underline">Go to login</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Flight surgeon</h1>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
      )}
      {reports.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No reports delivered yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((report) => (
            <li key={report.client_id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {report.kind} · {report.subject_label ?? report.subject_crew_id ?? "unknown"}
                </p>
                <span className="text-xs text-muted-foreground">{report.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">From {report.submitted_by} · {new Date(report.received_at).toUTCString()}</p>
              {report.summary_text && <p className="mt-1 text-sm text-foreground">{report.summary_text}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent">Raw values and steps</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs text-foreground">{report.payload_json}</pre>
              </details>
              {report.status !== "acknowledged" && (
                <button
                  type="button"
                  onClick={() => acknowledge(report.client_id)}
                  className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
                >
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
