import { lookupMeasure, PROVENANCES, type Measurement } from "@starplus/core";

export type ValidationResult = { ok: true } | { ok: false; reason: string };

const ONE_DAY_MS = 86_400_000;

/**
 * Mirrors the server's batch checks for a single record: known metric,
 * finite value, catalog unit, catalog bounds, timestamp present and not
 * more than a day in the future, provenance present. Returns the same
 * reason codes the server uses.
 */
export function validateRecord(record: Measurement, now = Date.now()): ValidationResult {
  const measure = lookupMeasure(record.metric);
  if (!measure || record.metric !== measure.code) return { ok: false, reason: "unknown_metric" };
  if (typeof record.value_num !== "number" || !Number.isFinite(record.value_num)) return { ok: false, reason: "invalid_schema" };
  if (record.value_num < measure.bounds.min || record.value_num > measure.bounds.max) return { ok: false, reason: "out_of_bounds" };
  if (record.unit !== measure.unit) return { ok: false, reason: "invalid_schema" };
  const measured = typeof record.measured_at === "string" ? Date.parse(record.measured_at) : NaN;
  if (Number.isNaN(measured)) return { ok: false, reason: "invalid_schema" };
  if (measured > now + ONE_DAY_MS) return { ok: false, reason: "future_timestamp" };
  if (!PROVENANCES.includes(record.provenance)) return { ok: false, reason: "missing_provenance" };
  return { ok: true };
}
