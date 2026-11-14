"use client";

import Link from "next/link";
import type { Measurement } from "@starplus/core";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CAREER_LIMIT_MSV, summarizeRadiation } from "@/lib/radiation-summary";
import { shortDate } from "@/lib/report-title";
import { useSepEvents } from "@/lib/use-sep-events";

export function RadiationCard({ measurements }: { measurements: Measurement[] }) {
  const summary = summarizeRadiation(measurements);
  const sep = useSepEvents();
  const feedDetail = sep ? `${sep.asOf ? `, ${sep.asOf}` : ""}${sep.fromCache ? ", cached" : ""}` : "";
  // The NASA DONKI line is always shown, so the live NASA data source stays visible
  // even in a quiet month or offline. Only real events get the watch styling.
  const sepNotice =
    sep && sep.events.length > 0 ? (
      <p role="status" className="mt-4 rounded-lg bg-status-watch-bg px-3 py-2 text-sm text-status-watch-fg">
        {sep.events.length} solar particle {sep.events.length === 1 ? "event" : "events"} recorded
        in the last 30 days (NASA DONKI space weather{feedDetail}). Shelter procedures are in the
        radiation hazard guidance.{" "}
        <Link className="underline" href="/hazards">
          Hazards
        </Link>
      </p>
    ) : sep ? (
      <p data-testid="donki-line" className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm text-foreground">
        No solar particle events in the last 30 days (NASA DONKI space weather{feedDetail}).
      </p>
    ) : (
      <p data-testid="donki-line" className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm text-muted">
        Live space weather from NASA DONKI loads when the device is online.
      </p>
    );
  return (
    <Card className="h-full p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title="Radiation"
        description="Logged dosimeter readings against the career limit."
        action={
          <Link
            href="/reports"
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring"
          >
            Full report
          </Link>
        }
      />
      {sepNotice}
      {summary.readingCount === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted">No dosimeter readings logged yet.</p>
          <Link
            href="/check"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring"
          >
            Log a reading
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-3xl font-bold tracking-tight">
            {summary.totalMsv.toFixed(1)}{" "}
            <span className="text-base font-medium text-muted">mSv logged</span>
          </p>
          <p className="mt-1 text-sm text-foreground">
            {summary.percentOfCareerLimit.toFixed(1)}% of the {CAREER_LIMIT_MSV} mSv career limit
          </p>
          <ProgressBar
            className="mt-2"
            value={summary.totalMsv}
            max={CAREER_LIMIT_MSV}
            label={`Share of the ${CAREER_LIMIT_MSV} mSv career limit`}
          />
          {summary.milestone > 0 && (
            <p role="status" className="mt-2 rounded-lg bg-status-watch-bg px-3 py-2 text-sm text-status-watch-fg">
              Logged exposure has reached {summary.milestone}% of the {CAREER_LIMIT_MSV} mSv career
              limit (NASA-STD-3001 Vol. 1 Rev. B). Review the radiation guidance with mission
              control.{" "}
              <Link className="underline" href="/hazards">
                Hazards
              </Link>
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            {summary.readingCount} {summary.readingCount === 1 ? "reading" : "readings"}
            {summary.latestAt ? ` · latest ${shortDate(summary.latestAt)}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">Source: NASA-STD-3001 Vol. 1 Rev. B.</p>
        </div>
      )}
    </Card>
  );
}
