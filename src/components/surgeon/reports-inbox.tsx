"use client";

import { useState } from "react";
import { inboxTitle } from "@/lib/report-title";
import { ReportPhotos } from "./report-photos";

export interface InboxReport {
  client_id: string;
  kind: string;
  submitted_by: string;
  received_at: string;
  created_at: string;
  summary_text: string | null;
  payload_json: string;
  status: string;
}

export function ReportsInbox({
  token,
  reports,
  names,
  updatedAt,
  onAcknowledge,
}: {
  token: string;
  reports: InboxReport[];
  names: Map<string, string>;
  updatedAt: string | null;
  onAcknowledge: (clientId: string) => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const visible = reports.filter((report) => filter === "all" || report.status !== "acknowledged");

  async function acknowledge(clientId: string) {
    setBusy(clientId);
    try {
      await onAcknowledge(clientId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Reports inbox" className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Reports</h2>
        {updatedAt && <p className="text-xs text-muted-foreground">Last updated {updatedAt}</p>}
      </div>
      <div className="mt-2 flex gap-2" role="group" aria-label="Report filters">
        {(["open", "all"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              filter === option
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground"
            }`}
          >
            {option === "open" ? "Open" : "All"}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {filter === "open" ? "No open reports." : "No reports delivered yet."}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {visible.map((report) => (
            <li key={report.client_id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  {inboxTitle(report.kind, names.get(report.submitted_by) ?? report.submitted_by, report.received_at || report.created_at)}
                </p>
                <span className="text-xs text-muted-foreground">{report.status}</span>
              </div>
              {report.summary_text && <p className="mt-1 text-sm text-foreground">{report.summary_text}</p>}
              <ReportPhotos token={token} report={report} />
              {report.status !== "acknowledged" && (
                <button
                  type="button"
                  disabled={busy === report.client_id}
                  onClick={() => void acknowledge(report.client_id)}
                  className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
