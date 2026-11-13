import type { Measurement } from "@starplus/core";

export interface FitnessDay {
  date: string;
  minutes: number;
}

export interface FitnessSummary {
  activeMinutes7d: number;
  activeDays: FitnessDay[];
  avgSleep7d: number | null;
  sleepNights: number;
  latestMassKg: number | null;
  latestMassAt: string | null;
  massDelta30dKg: number | null;
  checkinDays7d: number;
}

const DAY_MS = 86_400_000;

function dayOf(measuredAt: string): string {
  return measuredAt.slice(0, 10);
}

function inWindow(measuredAt: string, now: number, days: number): boolean {
  const at = Date.parse(measuredAt);
  return Number.isFinite(at) && at <= now && now - at < days * DAY_MS;
}

/**
 * Totalling of logged activity, sleep and body-mass readings. Percentages
 * against personal baselines come from assess(); this report only adds up
 * what was logged. No published fitness limits are encoded.
 */
export function summarizeFitness(measurements: readonly Measurement[], now: number = Date.now()): FitnessSummary {
  const recent7d = measurements.filter(
    (measurement) => measurement.value_num !== null && inWindow(measurement.measured_at, now, 7)
  );
  const byDay = new Map<string, number>();
  for (const measurement of recent7d) {
    if (measurement.metric !== "physical_activity") continue;
    const day = dayOf(measurement.measured_at);
    byDay.set(day, (byDay.get(day) ?? 0) + (measurement.value_num ?? 0));
  }
  const activeDays = [...byDay.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const activeMinutes7d = activeDays.reduce((sum, day) => sum + day.minutes, 0);

  const sleeps = recent7d.filter((measurement) => measurement.metric === "sleep_hours");
  const avgSleep7d =
    sleeps.length > 0
      ? sleeps.reduce((sum, measurement) => sum + (measurement.value_num ?? 0), 0) / sleeps.length
      : null;

  const masses = measurements
    .filter((measurement) => measurement.metric === "body_mass" && measurement.value_num !== null)
    .sort((a, b) => (a.measured_at < b.measured_at ? -1 : a.measured_at > b.measured_at ? 1 : 0));
  const latest = masses.length > 0 ? masses[masses.length - 1] : null;
  const oldest30d = masses.find((measurement) => inWindow(measurement.measured_at, now, 30)) ?? null;
  const massDelta30dKg =
    latest && oldest30d && latest !== oldest30d
      ? (latest.value_num ?? 0) - (oldest30d.value_num ?? 0)
      : null;

  const checkinDays7d = new Set(recent7d.map((measurement) => dayOf(measurement.measured_at))).size;

  return {
    activeMinutes7d,
    activeDays,
    avgSleep7d,
    sleepNights: sleeps.length,
    latestMassKg: latest?.value_num ?? null,
    latestMassAt: latest?.measured_at ?? null,
    massDelta30dKg,
    checkinDays7d,
  };
}
