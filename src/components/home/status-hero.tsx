"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ICONS = {
  nominal: CheckCircle2,
  watch: AlertCircle,
  critical: AlertTriangle,
  insufficient: HelpCircle,
} as const;

type HeroStatus = keyof typeof ICONS;

function toStatus(status: string | null): HeroStatus {
  return status === "nominal" || status === "watch" || status === "critical" || status === "insufficient"
    ? status
    : "insufficient";
}

function assessedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StatusHeroProps {
  status: string | null;
  assessedAt: string | null;
  checkHref: string;
  reportsHref: string;
  setting?: string;
  dailyDone?: number;
  dailyTotal?: number;
}

function galaxyClass(setting?: string): string {
  if (setting === "moon_base") return "galaxy-moon";
  if (setting === "mars_transit") return "galaxy-mars";
  return "galaxy-iss";
}

export function StatusHero({ status, assessedAt, checkHref, reportsHref, setting, dailyDone, dailyTotal }: StatusHeroProps) {
  const name = toStatus(status);
  const Icon = ICONS[name];
  return (
    <Card variant="hero" glow={name} hud className="relative overflow-hidden p-5 lg:p-6">
      <span aria-hidden="true" className={`hero-galaxy ${galaxyClass(setting)}`} />
      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-white/70">
        Overall status
      </p>
      <div role="status" className="mt-2 flex items-center gap-2">
        {status ? (
          <>
            <span className="sr-only">Overall: </span>
            <Icon className="h-8 w-8 shrink-0" aria-hidden />
            <span className="text-[2rem] font-normal capitalize tracking-tight md:text-[2.75rem]">{name}</span>
          </>
        ) : (
          <p className="text-[2rem] font-normal tracking-tight md:text-[2.75rem]">No check-in yet</p>
        )}
      </div>
      <p className="mt-2 text-sm text-white/70">
        {status && assessedAt
          ? `Last assessed ${assessedLabel(assessedAt)}`
          : "Your first self-check starts your personal baseline."}
      </p>
      {typeof dailyTotal === "number" && dailyTotal > 0 ? (
        <p className="mt-4 text-sm text-white/80" data-testid="daily-count">
          {typeof dailyDone === "number" && dailyDone >= dailyTotal
            ? "Today's check complete ✓"
            : `Today's check: ${dailyDone ?? 0} of ${dailyTotal}`}
          {typeof dailyDone === "number" && dailyDone < dailyTotal ? ", about 2 minutes" : ""}
        </p>
      ) : (
        <p className="mt-4 text-sm text-white/70">
          Reminder: take today&apos;s check-in — two measures, under a minute.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="accent">
          <Link href={checkHref}>Start self-check</Link>
        </Button>
        {typeof dailyTotal === "number" && dailyTotal > 0 && (
          <Button asChild variant="outline" className="border-white/40 text-white hover:bg-white/10">
            <Link href="/check/daily">
              {typeof dailyDone === "number" && dailyDone > 0 ? "Continue today's check" : "Start today's check"}
            </Link>
          </Button>
        )}
        <Link
          href={reportsHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-ring"
        >
          Reports
        </Link>
      </div>
    </Card>
  );
}
