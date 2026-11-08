"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ackReport, ApiError, getAttachment, getReports } from "@/lib/api";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";

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

function attachmentIds(payloadJson: string): string[] {
  try {
    const payload = JSON.parse(payloadJson) as { attachments?: Array<{ id?: unknown }> };
    if (!Array.isArray(payload.attachments)) return [];
    return payload.attachments
      .map((attachment) => (typeof attachment.id === "string" ? attachment.id : ""))
      .filter((id) => id.length > 0);
  } catch {
    return [];
  }
}

function ReportPhotos({ token, report }: { token: string; report: ReportRow }) {
  const [urls, setUrls] = useState<Array<{ id: string; url: string }>>([]);
  const [expired, setExpired] = useState<string[]>([]);
  const ids = attachmentIds(report.payload_json);
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      for (const id of attachmentIds(report.payload_json)) {
        try {
          const blob = await getAttachment(token, id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setUrls((prev) => [...prev, { id, url }]);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && error.status === 404) {
            setExpired((prev) => [...prev, id]);
          }
        }
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [token, report.client_id, report.payload_json]);
  if (ids.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-foreground">Photos</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map(({ id, url }) => (
          <img key={id} src={url} alt="Report photo" data-testid="photo-thumb" className="h-24 w-24 rounded-lg border border-border object-cover" />
        ))}
        {expired.map((id) => (
          <p key={id} className="text-xs text-muted-foreground">
            Photo expired (90 days)
          </p>
        ))}
      </div>
    </div>
  );
}

function SurgeonView() {
  const { crewId, ready: crewReady } = useActiveCrew();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [token, setToken] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crewReady) return;
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
        const body = await getReports(session.token, null, "desc");
        setReports(body.reports as ReportRow[]);
      } catch {
        setError("Could not load reports. Check the link and try again.");
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  async function acknowledge(client_id: string) {
    setError(null);
    try {
      await ackReport(token, client_id);
      const body = await getReports(token, null, "desc");
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
          <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=surgeon" className="text-accent underline">Try the demo</Link>
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
              <ReportPhotos token={token} report={report} />
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
