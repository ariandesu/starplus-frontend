"use client";

import { useEffect, useState } from "react";
import { localDay, lookupMeasure, todayLocal, type Measurement, type Result } from "@starplus/core";
import { deviceDb, profileDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export interface DailyStep {
  key: string;
  metrics: string[];
  label: string;
  done: boolean;
}

export interface DailyPlan {
  steps: DailyStep[];
  done: number;
  total: number;
}

export interface DailyPlanOptions {
  timeZone: string;
  demo?: boolean;
  deviceId?: string | null;
  now?: number;
}

/** The eleven steps of a normal day, in the order the run walks them. */
const BASE_STEPS: { key: string; metrics: string[]; label: string }[] = [
  { key: "heart_rate", metrics: ["heart_rate"], label: "Heart rate" },
  {
    key: "blood_pressure",
    metrics: ["blood_pressure_systolic", "blood_pressure_diastolic"],
    label: "Blood pressure",
  },
  { key: "oxygen_saturation", metrics: ["oxygen_saturation"], label: "Blood oxygen saturation" },
  { key: "temperature_c", metrics: ["temperature_c"], label: "Core body temperature" },
  { key: "respiratory_rate", metrics: ["respiratory_rate"], label: "Respiratory rate" },
  { key: "sleep_hours", metrics: ["sleep_hours"], label: "Sleep duration" },
  { key: "water_intake", metrics: ["water_intake"], label: "Water intake" },
  { key: "mood_score", metrics: ["mood_score"], label: "Mood score" },
  { key: "cabin_co2", metrics: ["cabin_co2"], label: "Cabin carbon dioxide" },
  { key: "cabin_o2", metrics: ["cabin_o2"], label: "Cabin oxygen" },
  { key: "cabin_temperature", metrics: ["cabin_temperature"], label: "Cabin temperature" },
];

/**
 * Today's plan: the eleven daily steps, plus anything the latest result flagged
 * as watch or critical. A step is done when a real reading of one of its
 * measures landed today, in the device's own time zone.
 */
export function buildDailyPlan(
  measurements: Measurement[],
  latestResult: Result | null,
  options: DailyPlanOptions
): DailyPlan {
  const { timeZone, demo = false, deviceId = null, now = Date.now() } = options;
  const today = todayLocal(timeZone, now);

  // Real readings from any device count. A demo session also counts its own
  // synthetic seed, but only from this device, so a judge starts at 0 of 11.
  const counts = (m: Measurement) =>
    m.voided === 0 &&
    localDay(m.measured_at, timeZone) === today &&
    (demo
      ? m.provenance === "real" || (m.provenance === "synthetic" && m.device_id === deviceId)
      : m.provenance === "real");

  const done = (metrics: string[]) => measurements.some((m) => counts(m) && metrics.includes(m.metric));

  const steps: DailyStep[] = BASE_STEPS.map((step) => ({ ...step, done: done(step.metrics) }));

  const known = new Set(steps.flatMap((step) => step.metrics));
  for (const per of latestResult?.per_measure ?? []) {
    if (per.status !== "watch" && per.status !== "critical") continue;
    if (known.has(per.metric)) continue;
    known.add(per.metric);
    steps.push({
      key: per.metric,
      metrics: [per.metric],
      label: lookupMeasure(per.metric)?.label ?? per.metric,
      done: done([per.metric]),
    });
  }

  return { steps, done: steps.filter((step) => step.done).length, total: steps.length };
}

export interface FinishOutcome {
  assess: boolean;
  resultId: string | null;
}

/**
 * Finishing with nothing recorded must not assess: a result built from older
 * readings would award today's check-in through scoreDays.
 */
export function finishOutcome(recordedThisRun: number, latest: Result | null): FinishOutcome {
  if (recordedThisRun > 0) return { assess: true, resultId: null };
  return { assess: false, resultId: latest?.client_id ?? null };
}

/** Reads the device's own history the way the Progress page does. */
export function useDailyPlan(crewId: string | null): DailyPlan | null {
  const [plan, setPlan] = useState<DailyPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!crewId) {
        setPlan(null);
        return;
      }
      const [db, device, session] = await Promise.all([profileDb(crewId), deviceDb(), getSession(crewId)]);
      const [measurements, results, deviceRow] = await Promise.all([
        db.getAll("measurements"),
        db.getAll("results"),
        device.get("settings", "device_id"),
      ]);
      const latest = [...results].sort(
        (a, b) => Date.parse(a.assessed_at) - Date.parse(b.assessed_at)
      ).pop();
      const next = buildDailyPlan(measurements, latest ?? null, {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        demo: Boolean(session?.demo),
        deviceId: deviceRow?.value ?? null,
        now: Date.now(),
      });
      if (!cancelled) setPlan(next);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crewId]);

  return plan;
}
