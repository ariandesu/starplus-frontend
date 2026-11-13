"use client";

import { useCallback, useEffect, useState } from "react";
import { CATALOG, localDay, todayLocal, type Measurement, type Result } from "@starplus/core";
import { deviceDb, profileDb } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * XP rewards completing a measurement, never its value. The same reading
 * earns the same XP whether nominal or critical; estimates, voided readings
 * and other people's data earn nothing.
 */

export interface XpStep {
  key: string;
  metrics: string[];
  label: string;
}

/** The eleven steps of a normal day, mirroring buildDailyPlan (R1). */
export const BASE_XP_STEPS: XpStep[] = [
  { key: "heart_rate", metrics: ["heart_rate"], label: "Heart rate" },
  { key: "blood_pressure", metrics: ["blood_pressure_systolic", "blood_pressure_diastolic"], label: "Blood pressure" },
  { key: "oxygen_saturation", metrics: ["oxygen_saturation"], label: "Blood oxygen" },
  { key: "temperature_c", metrics: ["temperature_c"], label: "Temperature" },
  { key: "respiratory_rate", metrics: ["respiratory_rate"], label: "Breathing rate" },
  { key: "sleep_hours", metrics: ["sleep_hours"], label: "Sleep" },
  { key: "water_intake", metrics: ["water_intake"], label: "Water" },
  { key: "mood_score", metrics: ["mood_score"], label: "Mood" },
  { key: "cabin_co2", metrics: ["cabin_co2"], label: "Cabin carbon dioxide" },
  { key: "cabin_o2", metrics: ["cabin_o2"], label: "Cabin oxygen" },
  { key: "cabin_temperature", metrics: ["cabin_temperature"], label: "Cabin temperature" },
];

const STEP_XP = 10;
const EXTRA_MEASURE_XP = 5;
const FULL_CHECK_BONUS = 50;

const RANKS: { level: number; rank: string; from: number }[] = [
  { level: 1, rank: "Cadet", from: 0 },
  { level: 2, rank: "Specialist", from: 100 },
  { level: 3, rank: "Pilot", from: 250 },
  { level: 4, rank: "Flight Engineer", from: 500 },
  { level: 5, rank: "Commander", from: 1000 },
  { level: 6, rank: "Mission Veteran", from: 2000 },
];

export interface XpSummary {
  total: number;
  today: number;
  level: number;
  rank: string;
  levelFloor: number;
  nextLevelAt: number | null;
  fullCheckToday: boolean;
}

export interface XpOptions {
  timeZone: string;
  demo?: boolean;
  deviceId?: string | null;
  now?: number;
}

function rankFor(total: number): { level: number; rank: string; levelFloor: number; nextLevelAt: number | null } {
  let current = RANKS[0];
  let next: (typeof RANKS)[number] | null = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (total >= RANKS[i].from) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { level: current.level, rank: current.rank, levelFloor: current.from, nextLevelAt: next?.from ?? null };
}

/** The rank a total XP value reaches. Used for rank-up detection. */
export function rankForTotal(total: number): { level: number; rank: string; levelFloor: number; nextLevelAt: number | null } {
  return rankFor(total);
}

/**
 * An eligible reading: the buildDailyPlan (R1) provenance rule, plus not
 * voided and not an estimate. Value is never consulted.
 */
export function eligibleForXp(
  m: Measurement,
  options: { demo?: boolean; deviceId?: string | null }
): boolean {
  if (m.voided !== 0) return false;
  if (m.is_estimate !== 0) return false;
  const { demo = false, deviceId = null } = options;
  if (demo) return m.provenance === "real" || (m.provenance === "synthetic" && m.device_id === deviceId);
  return m.provenance === "real";
}

function extraMetrics(latestResult: Result | null): string[] {
  const base = new Set(BASE_XP_STEPS.flatMap((step) => step.metrics));
  const extras: string[] = [];
  for (const per of latestResult?.per_measure ?? []) {
    if (per.status !== "watch" && per.status !== "critical") continue;
    if (base.has(per.metric)) continue;
    if (extras.includes(per.metric)) continue;
    extras.push(per.metric);
  }
  return extras;
}

function xpForDay(dayReadings: Measurement[], extras: string[]): { dayTotal: number; baseDone: number } {
  const has = (metrics: string[]) => dayReadings.some((m) => metrics.includes(m.metric));
  const baseDoneSteps = BASE_XP_STEPS.filter((step) => has(step.metrics));
  const extraDone = extras.filter((metric) => has([metric]));
  const counted = new Set([...BASE_XP_STEPS.flatMap((step) => step.metrics), ...extras]);
  const catalogCodes = new Set(CATALOG.measures.map((m) => m.code));
  const otherDone = new Set<string>();
  for (const m of dayReadings) {
    if (!catalogCodes.has(m.metric)) continue;
    if (counted.has(m.metric)) continue;
    otherDone.add(m.metric);
  }
  const dayTotal =
    baseDoneSteps.length * STEP_XP +
    extraDone.length * STEP_XP +
    otherDone.size * EXTRA_MEASURE_XP +
    (baseDoneSteps.length === BASE_XP_STEPS.length ? FULL_CHECK_BONUS : 0);
  return { dayTotal, baseDone: baseDoneSteps.length };
}

/**
 * Total XP is the sum over every local day in the history. Nothing is
 * stored or sent; this is computed from the readings already on the device.
 */
export function computeXp(
  measurements: Measurement[],
  latestResult: Result | null,
  options: XpOptions
): XpSummary {
  const { timeZone, demo = false, deviceId = null, now = Date.now() } = options;
  const extras = extraMetrics(latestResult);
  const byDay = new Map<string, Measurement[]>();
  for (const m of measurements) {
    if (!eligibleForXp(m, { demo, deviceId })) continue;
    const day = localDay(m.measured_at, timeZone);
    const list = byDay.get(day) ?? [];
    list.push(m);
    byDay.set(day, list);
  }
  let total = 0;
  let today = 0;
  let fullCheckToday = false;
  const todayKey = todayLocal(timeZone, now);
  for (const [day, readings] of byDay) {
    // The +10 re-check rule follows the latest result, which only describes
    // today. Past days keep the plain rule (+10 base steps, +5 other
    // measures) so history is never re-scored when a result changes.
    const { dayTotal, baseDone } = xpForDay(readings, day === todayKey ? extras : []);
    total += dayTotal;
    if (day === todayKey) {
      today = dayTotal;
      fullCheckToday = baseDone === BASE_XP_STEPS.length;
    }
  }
  const { level, rank, levelFloor, nextLevelAt } = rankFor(total);
  return { total, today, level, rank, levelFloor, nextLevelAt, fullCheckToday };
}

export interface XpGain {
  gained: number;
  levelUp: boolean;
  newRank: string | null;
  fullCheck: boolean;
}

/** Compares two summaries so the UI can animate the difference. */
export function xpGain(before: XpSummary, after: XpSummary): XpGain {
  return {
    gained: Math.max(after.total - before.total, 0),
    levelUp: after.level > before.level,
    newRank: after.level > before.level ? after.rank : null,
    fullCheck: after.fullCheckToday && !before.fullCheckToday,
  };
}

/** Reads the device's own history the way useDailyPlan does. */
export function useXp(crewId: string | null): { xp: XpSummary | null; refresh: () => void } {
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!crewId) {
        setXp(null);
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
      const next = computeXp(measurements, latest ?? null, {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        demo: Boolean(session?.demo),
        deviceId: deviceRow?.value ?? null,
        now: Date.now(),
      });
      if (!cancelled) setXp(next);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crewId, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { xp, refresh };
}
