"use client";

import * as React from "react";
import Link from "next/link";
import { lookupMeasure } from "@starplus/core";
import { Card, CardHeader } from "@/components/ui/card";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { sortVitals } from "@/lib/vital-order";
import { shortDate } from "@/lib/report-title";
import type { MeasureEntry } from "@/lib/health-summary";

interface MeasuresCardProps {
  entries: MeasureEntry[];
  checkHref: string;
  /** When set, each tile opens the result it came from, where "What to do" is shown. */
  crewId?: string;
}

export function resultHref(crewId: string, resultId: string): string {
  return `/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(resultId)}`;
}

export function MeasuresCard({ entries, checkHref, crewId }: MeasuresCardProps) {
  const shown = sortVitals(entries).slice(0, 4);
  return (
    <Card className="h-full p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title="Measures to watch"
        description="From your latest readings."
        action={
          <Link href="/history" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring">
            See all
          </Link>
        }
      />
      {shown.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted">No readings yet.</p>
          <Link
            href={checkHref}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring"
          >
            Start a self-check
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          {shown.map((entry) => {
            const measure = lookupMeasure(entry.metric);
            const baseline = entry.values.baseline_mean;
            const label = measure?.label ?? entry.metric;
            const value = entry.values.value === null ? "—" : String(entry.values.value);
            const tile = (
              <MetricTile
                eyebrow={measure ? measure.body_system.replace(/_/g, " ") : ""}
                label={label}
                value={value}
                unit={entry.values.unit}
                status={entry.status}
                zScore={entry.values.z_score}
                baselineText={
                  entry.values.z_score === null || baseline === null
                    ? "No baseline yet"
                    : `Baseline ${baseline.toFixed(1)} ${entry.values.unit}`
                }
                dateText={shortDate(entry.assessed_at)}
                className={crewId && entry.result_id ? "h-full transition-colors group-hover:bg-surface-2" : undefined}
              />
            );
            if (!crewId || !entry.result_id) return <React.Fragment key={entry.metric}>{tile}</React.Fragment>;
            return (
              <Link
                key={entry.metric}
                href={resultHref(crewId, entry.result_id)}
                data-testid={`measure-link-${entry.metric}`}
                aria-label={`${label}: ${value}${entry.values.unit ? ` ${entry.values.unit}` : ""}, ${entry.status}. Open the result and what to do`}
                className="group block rounded-tile focus-ring"
              >
                {tile}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
