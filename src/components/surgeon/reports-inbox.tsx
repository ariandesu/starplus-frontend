"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
        {updatedAt && <p className="text-xs text-muted">Last updated {updatedAt}</p>}
      </div>
      <div className="mt-2">
        <SegmentedControl
          ariaLabel="Report filters"
          value={filter}
          onChange={(value) => setFilter(value === "all" ? "all" : "open")}
          options={[
            { value: "open", label: "Open" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {filter === "open" ? "No open reports." : "No reports delivered yet."}
        </p>
      ) : (
        <Card className="mt-3 p-0">
          <ul className="divide-y divide-border">
            {visible.map((report) => {
              const emergency = report.kind === "emergency";
              return (
                <li
                  key={report.client_id}
                  className={cn("p-4", emergency && "border-l-4 border-danger")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {inboxTitle(
                          report.kind,
                          names.get(report.submitted_by) ?? report.submitted_by,
                          report.received_at || report.created_at
                        )}
                      </p>
                      {emergency && <p className="mt-1 text-sm font-semibold text-danger">Emergency</p>}
                      {report.summary_text && (
                        <p className="mt-1 text-sm text-foreground">{report.summary_text}</p>
                      )}
                      <ReportPhotos token={token} report={report} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge>{report.status}</Badge>
                      {report.status !== "acknowledged" && (
                        <button
                          type="button"
                          disabled={busy === report.client_id}
                          onClick={() => void acknowledge(report.client_id)}
                          className="min-h-11 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </section>
  );
}
