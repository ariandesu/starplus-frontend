"use client";

import { API_BASE } from "@/lib/api";
import { deviceDb, profileDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export interface ConsultCitation {
  title: string;
  publisher: string;
  year: string;
  url: string;
}

export interface ConsultAnswer {
  answer: string;
  citations: ConsultCitation[];
}

export class ConsultError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function postConsult(token: string, body: unknown): Promise<ConsultAnswer> {
  const res = await fetch(`${API_BASE}/api/consult`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConsultError(res.status, text || `The assistant failed (${res.status}).`);
  }
  return (await res.json()) as ConsultAnswer;
}

async function consultContext(crewId: string): Promise<{ token: string; deviceId: string }> {
  const [session, device] = await Promise.all([getSession(crewId), deviceDb()]);
  if (!session) throw new ConsultError(401, "Log in to ask the assistant.");
  const deviceRow = await device.get("settings", "device_id");
  return { token: session.token, deviceId: (deviceRow?.value as string | undefined) ?? "" };
}

/** Asks the assistant about KB entries. Each attempt counts toward the hourly limit. */
export async function askQuestion(
  crewId: string,
  options: { question: string; entryIds: string[] }
): Promise<ConsultAnswer> {
  const { token, deviceId } = await consultContext(crewId);
  return postConsult(token, {
    kind: "question",
    question: options.question,
    entry_ids: options.entryIds,
    device_id: deviceId,
  });
}

const medicineKey = (medicineId: string) => `medicine-explainer:${medicineId}`;

/**
 * Explains a medicine once, then keeps the reply in the device's content
 * store. Later visits (including offline) read the stored reply and never
 * call the model again.
 */
export async function explainMedicine(
  crewId: string,
  medicineId: string
): Promise<{ answer: ConsultAnswer; cached: boolean }> {
  const db = await profileDb(crewId);
  const stored = (await db.get("content", medicineKey(medicineId))) as { id: string; json: string } | undefined;
  if (stored) return { answer: JSON.parse(stored.json) as ConsultAnswer, cached: true };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ConsultError(0, "Connect once to load this explanation; it is then kept on this device.");
  }
  const { token, deviceId } = await consultContext(crewId);
  const answer = await postConsult(token, { kind: "medicine", medicine_id: medicineId, device_id: deviceId });
  await db.put("content", { id: medicineKey(medicineId), json: JSON.stringify(answer) });
  return { answer, cached: false };
}
