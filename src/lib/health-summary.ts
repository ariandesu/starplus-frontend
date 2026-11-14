import type { OverallStatus, PerMeasureResult, Result } from "@starplus/core";

/** One measure's newest result, with the id of the result it came from (for linking). */
export type MeasureEntry = PerMeasureResult & { assessed_at: string; result_id: string };

export type StatusCounts = Record<OverallStatus, number>;

/** Anything with a measures list, such as the body systems in body-map.tsx. */
export interface SystemWithMeasures {
  measures: readonly string[];
}

const STATUSES: OverallStatus[] = ["nominal", "watch", "critical", "insufficient"];
const SEVERITY: OverallStatus[] = ["critical", "watch", "nominal", "insufficient"];

function isStatus(value: string): value is OverallStatus {
  return (STATUSES as string[]).includes(value);
}

/**
 * The newest entry for each measure. Results are walked in assessed_at order,
 * so a later result replaces only the measures it actually contains.
 */
export function latestPerMeasure(results: Result[]): MeasureEntry[] {
  const ordered = [...results].sort((a, b) =>
    a.assessed_at < b.assessed_at ? -1 : a.assessed_at > b.assessed_at ? 1 : 0
  );
  const latest = new Map<string, MeasureEntry>();
  for (const result of ordered) {
    for (const entry of result.per_measure) {
      latest.set(entry.metric, { ...entry, assessed_at: result.assessed_at, result_id: result.client_id });
    }
  }
  return [...latest.values()];
}

export function countByStatus(entries: ReadonlyArray<{ status: string }>): StatusCounts {
  const counts: StatusCounts = { nominal: 0, watch: 0, critical: 0, insufficient: 0 };
  for (const entry of entries) {
    if (isStatus(entry.status)) counts[entry.status] += 1;
  }
  return counts;
}

/**
 * The most severe status among a system's measures, using only statuses that
 * `assess()` already produced. Null when the system has no entry at all.
 */
export function systemStatus(
  system: SystemWithMeasures,
  entries: ReadonlyArray<{ metric: string; status: string }>
): OverallStatus | null {
  const statuses = entries
    .filter((entry) => system.measures.includes(entry.metric))
    .map((entry) => entry.status);
  if (statuses.length === 0) return null;
  return SEVERITY.find((status) => statuses.includes(status)) ?? null;
}

/** The fixed summary sentence from plan 6.3. No advice, no thresholds. */
export function summarySentence(counts: StatusCounts): string {
  if (counts.critical > 0) {
    return `${counts.critical} ${counts.critical === 1 ? "measure" : "measures"} critical.`;
  }
  if (counts.watch > 0) {
    return `${counts.watch} ${counts.watch === 1 ? "measure" : "measures"} to watch.`;
  }
  if (counts.nominal > 0) return "All measured values are nominal.";
  return "No check-in yet.";
}
