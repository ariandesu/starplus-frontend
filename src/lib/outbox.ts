import type { Measurement, Report, Result } from "@starplus/core";
import { deviceDb, profileDb, type OutboxItem } from "./db";
import { getSession, listProfiles } from "./session";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend.shareflow.workers.dev";

export const OUTBOX_BASE_MS = 5000;
export const OUTBOX_MAX_MS = 10 * 60_000;
export const OUTBOX_START_ITEMS = 100;

export function computeBackoffMs(failures: number, random: () => number = Math.random): number {
  const capped = Math.min(OUTBOX_BASE_MS * 2 ** failures, OUTBOX_MAX_MS);
  return Math.round(capped * (1 + (random() * 0.4 - 0.2)));
}

async function maxItems(): Promise<number> {
  const db = await deviceDb();
  const stored = await db.get("settings", "outbox_max_items");
  const parsed = stored ? Number.parseInt(stored.value, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : OUTBOX_START_ITEMS;
}

async function setMaxItems(value: number): Promise<void> {
  const db = await deviceDb();
  await db.put("settings", { key: "outbox_max_items", value: String(value) });
}

async function nextRetryAt(): Promise<number | null> {
  const db = await deviceDb();
  const stored = await db.get("settings", "outbox_next_retry_at");
  return stored ? Number.parseInt(stored.value, 10) : null;
}

async function setNextRetryAt(when: number | null): Promise<void> {
  const db = await deviceDb();
  if (when === null) {
    await db.delete("settings", "outbox_next_retry_at");
  } else {
    await db.put("settings", { key: "outbox_next_retry_at", value: String(when) });
  }
}

export async function enqueue(item: Omit<OutboxItem, "state" | "attempts" | "error" | "created_at">): Promise<void> {
  const db = await deviceDb();
  await db.put("outbox", {
    ...item,
    state: "queued",
    attempts: 0,
    error: null,
    created_at: new Date().toISOString(),
  });
}

export async function enqueueMeasurement(crewId: string, record: Measurement): Promise<void> {
  const db = await profileDb(crewId);
  await db.put("measurements", record);
  await enqueue({ client_id: record.client_id, crew_id: crewId, kind: "measurement", payload: record });
}

export async function enqueueResult(crewId: string, result: Result): Promise<void> {
  const db = await profileDb(crewId);
  await db.put("results", result);
  await enqueue({ client_id: result.client_id, crew_id: crewId, kind: "result", payload: result });
}

export async function enqueueReport(crewId: string | null, report: Report): Promise<void> {
  if (crewId) {
    const db = await profileDb(crewId);
    await db.put("reports", report);
  }
  await enqueue({
    client_id: report.client_id,
    crew_id: report.submitted_by,
    kind: "report",
    payload: report,
  });
}

export async function pendingEmergencyCount(): Promise<number> {
  const db = await deviceDb();
  const items = await db.getAll("outbox");
  return items.filter(
    (item) => item.kind === "report" && (item.payload as Report).kind === "emergency" && item.state !== "failed"
  ).length;
}

export interface FlushOutcome {
  sent: number;
  failed: number;
  nextRetryAt: number | null;
}

export async function flush(now = Date.now()): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { sent: 0, failed: 0, nextRetryAt: null };
  const retryAt = await nextRetryAt();
  if (retryAt !== null && now < retryAt) {
    outcome.nextRetryAt = retryAt;
    return outcome;
  }
  const db = await deviceDb();
  const queued = (await db.getAll("outbox")).filter((item) => item.state === "queued");
  if (queued.length === 0) {
    await setNextRetryAt(null);
    return outcome;
  }

  const byCrew = new Map<string, OutboxItem[]>();
  for (const item of queued) {
    const group = byCrew.get(item.crew_id) ?? [];
    group.push(item);
    byCrew.set(item.crew_id, group);
  }

  let failures = 0;
  for (const [crewId, items] of byCrew) {
    const session = await getSession(crewId);
    if (!session) continue;
    const measurements = items.filter((item) => item.kind === "measurement").map((item) => item.payload as Measurement);
    const results = items.filter((item) => item.kind === "result").map((item) => item.payload as Result);
    const reports = items.filter((item) => item.kind === "report").map((item) => item.payload as Report);
    const limit = await maxItems();

    for (let i = 0; i < Math.max(measurements.length, results.length, 1); i += limit) {
      const chunk = {
        schema_version: 1 as const,
        catalog_version: "1",
        items: measurements.slice(i, i + limit),
        results: results.slice(i, i + limit),
      };
      if (chunk.items.length === 0 && chunk.results.length === 0) break;
      try {
        const res = await fetch(`${API_BASE}/api/measurements/batch`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });
        if (!res.ok) throw new Error(`batch ${res.status}`);
        const body = (await res.json()) as {
          accepted: string[];
          duplicates?: string[];
          max_items: number;
          rejected: Array<{ client_id: string; reason: string }>;
          retry_after?: number;
        };
        await setMaxItems(body.max_items);
        for (const client_id of [...body.accepted, ...(body.duplicates ?? [])]) {
          await db.delete("outbox", client_id);
          outcome.sent += 1;
        }
        for (const rejected of body.rejected) {
          await db.put("outbox", {
            ...(await db.get("outbox", rejected.client_id))!,
            state: "failed" as const,
            error: rejected.reason,
          });
          outcome.failed += 1;
        }
        if (body.retry_after !== undefined) {
          outcome.nextRetryAt = now + body.retry_after * 1000;
          await setNextRetryAt(outcome.nextRetryAt);
        }
      } catch (error) {
        failures += 1;
        for (const item of [...chunk.items, ...chunk.results]) {
          const current = await db.get("outbox", item.client_id);
          if (current) {
            await db.put("outbox", {
              ...current,
              state: "queued",
              attempts: current.attempts + 1,
              error: error instanceof Error ? error.message : "send failed",
            });
          }
        }
      }
    }

    for (const report of reports) {
      try {
        const res = await fetch(`${API_BASE}/api/reports`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
        if (!res.ok) throw new Error(`report ${res.status}`);
        await db.delete("outbox", report.client_id);
        await markReportDelivered(session.crew_id, report);
        outcome.sent += 1;
      } catch (error) {
        failures += 1;
        const current = await db.get("outbox", report.client_id);
        if (current) {
          await db.put("outbox", {
            ...current,
            state: "queued",
            attempts: current.attempts + 1,
            error: error instanceof Error ? error.message : "send failed",
          });
        }
      }
    }
  }

  if (failures > 0 && outcome.nextRetryAt === null) {
    const delay = computeBackoffMs(failures);
    outcome.nextRetryAt = now + delay;
    await setNextRetryAt(outcome.nextRetryAt);
  } else if (failures === 0 && outcome.failed === 0) {
    await setNextRetryAt(null);
  }

  await flushOrphanEmergencies(outcome);
  return outcome;
}

async function markReportDelivered(crewId: string, report: Report): Promise<void> {
  const pdb = await profileDb(crewId);
  await pdb.put("reports", { ...report, submitted_by: crewId, received_at: report.received_at || new Date().toISOString() });
}

async function flushOrphanEmergencies(outcome: FlushOutcome): Promise<void> {
  const db = await deviceDb();
  const queued = (await db.getAll("outbox")).filter(
    (item) => item.kind === "report" && item.state === "queued"
  );
  if (queued.length === 0) return;
  const sessions = [];
  for (const profile of await listProfiles()) {
    const session = await getSession(profile.crew_id);
    if (session) sessions.push(session);
  }
  if (sessions.length === 0) return;
  const sender = sessions[0];
  for (const item of queued) {
    const session = await getSession(item.crew_id);
    if (session) continue;
    const report = { ...(item.payload as Report), submitted_by: sender.crew_id };
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sender.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error(`report ${res.status}`);
      await db.delete("outbox", item.client_id);
      await markReportDelivered(sender.crew_id, { ...report, submitted_by: sender.crew_id });
      outcome.sent += 1;
    } catch (error) {
      await db.put("outbox", {
        ...item,
        attempts: item.attempts + 1,
        error: error instanceof Error ? error.message : "send failed",
      });
    }
  }
}
