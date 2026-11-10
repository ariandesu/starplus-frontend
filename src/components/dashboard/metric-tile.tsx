"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { RangeBar } from "@/components/dashboard/range-bar";

interface MetricTileProps {
  eyebrow: string;
  label: string;
  value: string;
  unit?: string;
  status: string;
  zScore: number | null;
  baselineText: string;
  dateText?: string;
  className?: string;
}

export function MetricTile({
  eyebrow,
  label,
  value,
  unit,
  status,
  zScore,
  baselineText,
  dateText,
  className,
}: MetricTileProps) {
  return (
    <Card variant="tile" className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted">
          {eyebrow}
        </p>
        <StatusPill status={status} />
      </div>
      <p className="mt-2 text-[2rem] font-normal tabular-nums tracking-tight md:text-5xl">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-sm text-foreground">{label}</p>
      <RangeBar zScore={zScore} ariaLabel={`${label} position`} className="mt-3" />
      <p className="mt-2 text-xs text-muted">{baselineText}</p>
      {dateText && <p className="font-mono text-xs text-muted">{dateText}</p>}
    </Card>
  );
}
