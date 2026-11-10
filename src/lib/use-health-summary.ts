"use client";

import { useEffect, useState } from "react";
import type { Measurement, Report, Result } from "@starplus/core";
import { profileDb } from "@/lib/db";
import {
  countByStatus,
  latestPerMeasure,
  type MeasureEntry,
  type StatusCounts,
} from "@/lib/health-summary";

export interface HealthSummary {
  ready: boolean;
  latestResult: Result | null;
  entries: MeasureEntry[];
  counts: StatusCounts;
  results: Result[];
  measurements: Measurement[];
  reports: Report[];
}

const EMPTY: HealthSummary = {
  ready: false,
  latestResult: null,
  entries: [],
  counts: countByStatus([]),
  results: [],
  measurements: [],
  reports: [],
};

/**
 * Everything Home shows, read once from the crew's profile database. No
 * network call: the same data works offline.
 */
export function useHealthSummary(crewId: string | null): HealthSummary {
  const [summary, setSummary] = useState<HealthSummary>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!crewId) {
        if (!cancelled) setSummary({ ...EMPTY, ready: true });
        return;
      }
      try {
        const db = await profileDb(crewId);
        const [results, measurements, reports] = await Promise.all([
          db.getAllFromIndex("results", "by-assessed"),
          db.getAll("measurements"),
          db.getAll("reports"),
        ]);
        if (cancelled) return;
        const entries = latestPerMeasure(results);
        setSummary({
          ready: true,
          latestResult: results.length > 0 ? results[results.length - 1] : null,
          entries,
          counts: countByStatus(entries),
          results,
          measurements,
          reports,
        });
      } catch {
        if (!cancelled) setSummary({ ...EMPTY, ready: true });
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crewId]);

  return summary;
}
