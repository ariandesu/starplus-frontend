"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/sparkline";
import type { MetricSeries } from "@/lib/vital-series";

export function TrendCard({ series }: { series: MetricSeries | null }) {
  if (!series || series.points.length < 2) return null;
  const latest = series.points[series.points.length - 1];
  return (
    <Card className="h-full p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title={series.label}
        description={`Latest ${latest.value} ${series.unit}`}
        action={
          <Link href="/history" className="text-sm font-medium text-accent-strong underline underline-offset-4">
            History
          </Link>
        }
      />
      <div className="mt-4">
        <Sparkline
          data={series.points.map((point) => point.value)}
          ariaLabel={`${series.label} trend`}
          className="h-16"
        />
      </div>
    </Card>
  );
}
