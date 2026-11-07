import * as React from "react";
import { HeartPulse, Droplets, Thermometer, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/dashboard/demo-badge";

export interface HeroVital {
  label: string;
  value: string;
  unit: string;
  /** "none" when there is no reading yet. */
  status: "normal" | "watch" | "critical" | "none";
  icon: "heart" | "spo2" | "temp" | "bp";
}

const ICONS = {
  heart: HeartPulse,
  spo2: Droplets,
  temp: Thermometer,
  bp: Activity,
} as const;

interface HeroSectionProps {
  vitals: HeroVital[];
  subject: string;
  updated?: string;
  isDemo?: boolean;
  className?: string;
}

export function HeroSection({ vitals, subject, updated, isDemo, className }: HeroSectionProps) {
  return (
    <section id="overview" className={cn("px-4 pt-8 pb-4 sm:px-6 max-w-6xl mx-auto w-full", className)}>
      <div className="mb-8">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight text-foreground mb-3">
          STAR PLUS
        </h1>
        <p className="text-base sm:text-lg text-muted max-w-2xl leading-relaxed">
          Astronaut health monitoring, WATCH signal detection and crew telemetry for long-duration missions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
        <h2 className="text-lg font-semibold text-foreground">Latest vitals · {subject}</h2>
        {isDemo ? <DemoBadge /> : updated && <span className="text-sm text-muted">Updated {updated}</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {vitals.map((vital) => {
          const Icon = ICONS[vital.icon];
          return (
            <Card key={vital.label} className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">{vital.label}</p>
                <Icon className="w-4 h-4 text-accent shrink-0" aria-hidden />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                {vital.value}
                {vital.unit && <span className="ml-1 text-sm font-normal text-muted">{vital.unit}</span>}
              </p>
              {vital.status === "none" ? (
                <span className="self-start text-xs text-muted">No data</span>
              ) : (
                <Badge
                  className="self-start"
                  variant={vital.status === "normal" ? "secondary" : vital.status === "watch" ? "outline" : "destructive"}
                >
                  {vital.status === "normal" ? "Nominal" : vital.status === "watch" ? "WATCH" : "CRITICAL"}
                </Badge>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
