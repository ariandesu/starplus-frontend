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
}

export function MeasuresCard({ entries, checkHref }: MeasuresCardProps) {
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
            return (
              <MetricTile
                key={entry.metric}
                eyebrow={measure ? measure.body_system.replace(/_/g, " ") : ""}
                label={measure?.label ?? entry.metric}
                value={entry.values.value === null ? "—" : String(entry.values.value)}
                unit={entry.values.unit}
                status={entry.status}
                zScore={entry.values.z_score}
                baselineText={
                  entry.values.z_score === null || baseline === null
                    ? "No baseline yet"
                    : `Baseline ${baseline.toFixed(1)} ${entry.values.unit}`
                }
                dateText={shortDate(entry.assessed_at)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
