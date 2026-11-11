"use client";

import {
  assess,
  loadModel,
  lookupMeasure,
  predict,
  sdFloorFor,
  type AssessContext,
  type Measurement,
  type Phase,
  type Result,
} from "@starplus/core";
import { profileDb } from "@/lib/db";
import { getModelDefinition } from "@/lib/kb";
import { enqueueMeasurement, enqueueResult } from "@/lib/outbox";

/**
 * The one place that turns readings into a result: builds the model input from
 * the crew's history exactly as the self-check does, assesses, then queues the
 * measurements and the result for the outbox.
 */
export async function assessAndQueue(
  crewId: string,
  records: Measurement[],
  options: { setting: string; phase: Phase }
): Promise<Result> {
  const db = await profileDb(crewId);
  const history = await db.getAll("measurements");

  const modelInput = (() => {
    try {
      const loaded = loadModel(getModelDefinition());
      if (!loaded.ok) return null;
      const features: Record<string, number> = {};
      for (const input of loaded.model.definition.inputs) {
        const measure = lookupMeasure(input.metric);
        const earlier = history
          .filter((r) => r.metric === input.metric && r.value_num !== null)
          .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
        const latest =
          [...earlier, ...records.filter((r) => r.metric === input.metric && r.value_num !== null)]
            .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at))
            .pop() ?? null;
        const values = earlier.map((r) => r.value_num as number);
        const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        const spread =
          values.length > 1
            ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
            : 0;
        const floor = measure ? sdFloorFor(measure, mean) : 1;
        const latestValue = (latest?.value_num as number | null) ?? 0;
        features[`${input.metric}:${input.feature}`] =
          input.feature === "latest" ? latestValue : (latestValue - mean) / Math.max(spread, floor);
      }
      const probability = predict(loaded.model.definition, features);
      return {
        probability,
        model_version: loaded.model.definition.model_version,
        model_id: loaded.model.definition.model_id,
        threshold_watch: loaded.model.threshold_watch,
      };
    } catch {
      return null;
    }
  })();

  const context: AssessContext = { now: Date.now(), phase: options.phase, model: modelInput };
  const result = await assess([...history, ...records], context);
  for (const record of records) await enqueueMeasurement(crewId, record);
  await enqueueResult(crewId, result);
  return result;
}
