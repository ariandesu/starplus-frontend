import type { Measurement, Phase, Provenance, Setting } from "@starplus/core";
import { validateRecord } from "./validate";

export interface ReactionContext {
  crewId: string;
  provenance: Provenance;
  deviceId?: string;
  measuredAt?: string;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
}

export function medianExcludingFirst(tapsMs: number[]): number {
  const [, ...rest] = tapsMs;
  if (rest.length === 0) throw new Error("need at least two taps: one practice tap plus one measured tap");
  const ordered = [...rest].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function reactionToRecord(
  tapsMs: number[],
  context: ReactionContext
): { record: Measurement } | { error: string } {
  if (!Array.isArray(tapsMs) || tapsMs.length < 2 || !tapsMs.every((tap) => Number.isFinite(tap) && tap > 0)) {
    return { error: "need at least two positive tap times in milliseconds" };
  }
  const medianMs = medianExcludingFirst(tapsMs);
  const record: Measurement = {
    client_id: crypto.randomUUID(),
    crew_id: context.crewId,
    metric: "reaction_time",
    value_num: Math.round(medianMs * 10) / 10,
    value_text: null,
    unit: "ms",
    measured_at: context.measuredAt ?? new Date().toISOString(),
    received_at: "",
    source: "test",
    device_id: context.deviceId ?? "reaction-test",
    capture_id: crypto.randomUUID(),
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: context.provenance,
    setting: context.setting ?? "iss",
    phase: context.phase ?? "inflight",
    phase_day: context.phaseDay ?? null,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
  };
  const checked = validateRecord(record);
  if (!checked.ok) return { error: checked.reason };
  return { record };
}
