import { assess, type Measurement, type Phase } from "@starplus/core";
import { profileDb } from "./db";
import { enqueueMeasurement, enqueueResult } from "./outbox";

/**
 * Runs the assess pipeline over history plus new records, queues the
 * records and the result for sync, and returns the new result id.
 */
export async function assessAndQueue(crewId: string, phase: Phase, records: Measurement[]): Promise<string> {
  const db = await profileDb(crewId);
  const history = await db.getAll("measurements");
  const result = await assess([...history, ...records], { now: Date.now(), phase, model: null });
  for (const record of records) await enqueueMeasurement(crewId, record);
  await enqueueResult(crewId, result);
  return result.client_id;
}
