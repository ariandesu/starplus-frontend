"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusName = "nominal" | "watch" | "critical" | "insufficient";

const ICONS = {
  nominal: CheckCircle2,
  watch: AlertCircle,
  critical: AlertTriangle,
  insufficient: HelpCircle,
} as const;

const STYLES: Record<StatusName, string> = {
  nominal: "bg-status-nominal-bg text-status-nominal-fg",
  watch: "bg-status-watch-bg text-status-watch-fg",
  critical: "bg-status-critical-bg text-status-critical-fg",
  insufficient: "bg-status-insufficient-bg text-status-insufficient-fg",
};

function toStatusName(status: string): StatusName {
  return status === "nominal" || status === "watch" || status === "critical" || status === "insufficient"
    ? status
    : "insufficient";
}

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const name = toStatusName(status);
  const Icon = ICONS[name];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        STYLES[name],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{name}</span>
    </span>
  );
}
