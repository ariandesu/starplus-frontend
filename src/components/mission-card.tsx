"use client";

import Link from "next/link";
import {
  Activity,
  AirVent,
  Droplets,
  Gauge,
  GlassWater,
  HeartPulse,
  Moon,
  RotateCcw,
  Smile,
  Thermometer,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useDailyPlan } from "@/lib/daily-plan";
import { BASE_XP_STEPS, useXp } from "@/lib/xp";
import { Card } from "@/components/ui/card";

const ICONS: Record<string, LucideIcon> = {
  heart_rate: HeartPulse,
  blood_pressure: Activity,
  oxygen_saturation: Droplets,
  temperature_c: Thermometer,
  respiratory_rate: Wind,
  sleep_hours: Moon,
  water_intake: GlassWater,
  mood_score: Smile,
  cabin_co2: AirVent,
  cabin_o2: Gauge,
  cabin_temperature: ThermometerSun,
};

const BASE_KEYS = new Set(BASE_XP_STEPS.map((step) => step.key));

/**
 * "Today's mission": the rank badge, total XP and the bar to the next rank,
 * the eleven daily steps as tappable tiles, and the full-check footer. The
 * form below stays exactly as it is.
 */
export function MissionCard({ crewId }: { crewId: string }) {
  const plan = useDailyPlan(crewId);
  const { xp } = useXp(crewId);

  const steps = plan?.steps ?? [];
  const doneByKey = new Map(steps.map((step) => [step.key, step.done]));
  const baseDone = BASE_XP_STEPS.filter((step) => doneByKey.get(step.key)).length;
  const full = baseDone === BASE_XP_STEPS.length;
  const range = xp && xp.nextLevelAt !== null ? xp.nextLevelAt - xp.levelFloor : 1;
  const done = xp ? Math.min(Math.max(xp.total - xp.levelFloor, 0), range) : 0;
  const dailyHref = crewId ? `/check/daily?crew=${encodeURIComponent(crewId)}` : "/check/daily";

  return (
    <Card data-testid="mission-card" className="mt-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p data-testid="xp-level" className="text-sm font-semibold text-foreground">
          Level {xp?.level ?? 1} · {xp?.rank ?? "Cadet"}
        </p>
        <p data-testid="xp-total" className="text-sm text-muted">
          {xp ? (xp.nextLevelAt !== null ? `${xp.total} / ${xp.nextLevelAt} XP` : `${xp.total} XP · top rank`) : "Loading XP…"}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="XP to the next rank"
        aria-valuenow={xp?.total ?? 0}
        aria-valuemin={xp?.levelFloor ?? 0}
        aria-valuemax={xp?.nextLevelAt ?? 1}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="xp-bar-fill h-full rounded-full bg-accent" style={{ width: `${(done / range) * 100}%` }} />
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Today's mission steps">
        {BASE_XP_STEPS.map((base) => {
          const isDone = doneByKey.get(base.key) ?? false;
          const Icon = ICONS[base.key] ?? Activity;
          const tile = (
            <>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="mt-1 block text-sm font-medium">{base.label}</span>
              <span className="mt-0.5 block text-xs">{isDone ? "✓ Done" : "+10 XP"}</span>
            </>
          );
          const classes =
            "flex min-h-11 flex-col items-start rounded-tile border border-border p-3 focus-ring " +
            (isDone ? "bg-surface text-foreground" : "bg-card text-foreground hover:bg-surface-2");
          return (
            <li key={base.key}>
              {isDone ? (
                <div data-testid={`mission-tile-${base.key}`} className={classes} aria-label={`${base.label}, done`}>
                  {tile}
                </div>
              ) : (
                <Link
                  data-testid={`mission-tile-${base.key}`}
                  href={`${dailyHref}${dailyHref.includes("?") ? "&" : "?"}step=${encodeURIComponent(base.key)}`}
                  aria-label={`${base.label}, open, earns 10 XP`}
                  className={classes}
                >
                  {tile}
                </Link>
              )}
            </li>
          );
        })}
        {steps
          .filter((step) => !BASE_KEYS.has(step.key))
          .map((step) => {
            const isDone = step.done;
            const classes =
              "flex min-h-11 flex-col items-start rounded-tile border border-dashed border-border p-3 focus-ring " +
              (isDone ? "bg-surface text-foreground" : "bg-card text-foreground hover:bg-surface-2");
            const body = (
              <>
                <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
                <span className="mt-1 block text-sm font-medium">{step.label}</span>
                <span className="mt-0.5 block text-xs">{isDone ? "✓ Done · Re-check" : "+10 XP · Re-check"}</span>
              </>
            );
            return (
              <li key={step.key}>
                {isDone ? (
                  <div data-testid={`mission-tile-${step.key}`} className={classes} aria-label={`${step.label}, done`}>
                    {body}
                  </div>
                ) : (
                  <Link
                    data-testid={`mission-tile-${step.key}`}
                    href={`${dailyHref}${dailyHref.includes("?") ? "&" : "?"}step=${encodeURIComponent(step.key)}`}
                    aria-label={`${step.label}, re-check, earns 10 XP`}
                    className={classes}
                  >
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {full
            ? "Full check complete ✓ · +50 XP earned"
            : `${baseDone} of ${BASE_XP_STEPS.length} done today · +50 XP for the full check`}
        </p>
        {!full && (
          <Link
            href={dailyHref}
            className="flex min-h-11 items-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-ring"
          >
            {baseDone > 0 ? "Continue today's check" : "Start today's check"}
          </Link>
        )}
      </div>
    </Card>
  );
}
