"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusName } from "@/components/ui/status-pill";

const DOTS: Record<StatusName, string> = {
  nominal: "bg-status-nominal-dot",
  watch: "bg-status-watch-dot",
  critical: "bg-status-critical-dot",
  insufficient: "bg-status-insufficient-dot",
};

interface StatCountProps {
  value: number | string;
  label: string;
  status?: StatusName;
  className?: string;
}

export function StatCount({ value, label, status, className }: StatCountProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-5xl font-normal tabular-nums tracking-tight">{value}</p>
      <div className="flex items-center gap-1.5">
        {status && <span className={cn("h-2 w-2 rounded-full", DOTS[status])} aria-hidden />}
        <span className="text-sm text-muted">{label}</span>
      </div>
    </div>
  );
}
