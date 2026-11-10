"use client";

import * as React from "react";
import Link from "next/link";
import type { Report } from "@starplus/core";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ownReportTitle } from "@/lib/report-title";

export function ReportsCard({ reports }: { reports: Report[] }) {
  if (reports.length === 0) return null;
  const latest = [...reports]
    .sort((a, b) => (b.received_at || b.created_at || "").localeCompare(a.received_at || a.created_at || ""))
    .slice(0, 3);
  return (
    <Card className="p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title="Reports"
        action={
          <Link href="/reports" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring">
            Reports
          </Link>
        }
      />
      <ul className="mt-2">
        {latest.map((report) => (
          <li
            key={report.client_id}
            className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 last:border-0"
          >
            <span className="text-sm text-foreground">
              {ownReportTitle(report.kind, report.received_at || report.created_at, report.status)}
            </span>
            <Badge>{report.status}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
