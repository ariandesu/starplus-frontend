import type { Measurement } from "@starplus/core";

/** Career limit the app measures logged exposure against (NASA-STD-3001 Vol. 1 Rev. B). */
export const CAREER_LIMIT_MSV = 600;

/** Fractions of the career limit that earn a milestone notice. */
export const MILESTONES = [25, 50, 75] as const;

export interface RadiationDay {
  date: string;
  mSv: number;
}

export interface RadiationSummary {
  totalMsv: number;
  percentOfCareerLimit: number;
  milestone: number;
  readingCount: number;
  latestAt: string | null;
  days: RadiationDay[];
}

/**
 * Running total of logged dosimeter readings, per the measure-radiation
 * guidance ("adds each day's dosimeter reading to a running total").
 * Milestones are arithmetic on the cited career limit, not new limits.
 */
export function summarizeRadiation(measurements: readonly Measurement[]): RadiationSummary {
  const readings = measurements.filter(
    (measurement) => measurement.metric === "radiation_dose" && measurement.value_num !== null
  );
  const totalMsv = readings.reduce((sum, reading) => sum + (reading.value_num ?? 0), 0);
  const percentOfCareerLimit = (totalMsv / CAREER_LIMIT_MSV) * 100;
  let milestone = 0;
  for (const mark of MILESTONES) {
    if (percentOfCareerLimit >= mark) milestone = mark;
  }
  const byDay = new Map<string, number>();
  for (const reading of readings) {
    const day = reading.measured_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + (reading.value_num ?? 0));
  }
  const days = [...byDay.entries()]
    .map(([date, mSv]) => ({ date, mSv }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-30);
  let latestAt: string | null = null;
  for (const reading of readings) {
    if (latestAt === null || reading.measured_at > latestAt) latestAt = reading.measured_at;
  }
  return {
    totalMsv,
    percentOfCareerLimit,
    milestone,
    readingCount: readings.length,
    latestAt,
    days,
  };
}
