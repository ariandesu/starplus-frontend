import { deviceDb, profileDb, type ProfileRecord } from "./db";
import { getSync } from "./api";
import type { Measurement, Report, Result } from "@starplus/core";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend.shareflow.workers.dev";

export interface SessionInfo {
  token: string;
  crew_id: string;
  role: string;
  expires_at: string;
  provenance: string;
  demo: boolean;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deviceId(): Promise<string> {
  const db = await deviceDb();
  const existing = await db.get("settings", "device_id");
  if (existing) return existing.value;
  const id = crypto.randomUUID();
  await db.put("settings", { key: "device_id", value: id });
  return id;
}

export async function deviceSalt(): Promise<string> {
  const db = await deviceDb();
  const existing = await db.get("settings", "pin_salt");
  if (existing) return existing.value;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await db.put("settings", { key: "pin_salt", value: salt });
  return salt;
}

export async function isSharedDevice(): Promise<boolean> {
  const db = await deviceDb();
  return (await db.get("settings", "shared_device"))?.value === "true";
}

export async function setSharedDevice(shared: boolean): Promise<void> {
  const db = await deviceDb();
  await db.put("settings", { key: "shared_device", value: shared ? "true" : "false" });
}

export async function login(accessCode: string): Promise<SessionInfo> {
  const id = await deviceId();
  const shared = await isSharedDevice();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: accessCode, device_id: id, ...(shared ? { shared: true } : {}) }),
    });
  } catch {
    throw new Error("Can't reach the server. Check the connection and try again. Your code has not been used.");
  }
  if (res.status === 401) throw new Error("That code did not work. Check it and try again.");
  if (res.status === 429) throw new Error("Too many tries. Wait a minute and try again.");
  if (!res.ok) throw new Error("Something went wrong. Try again.");
  try {
    const session = (await res.json()) as SessionInfo;
    const db = await deviceDb();
    const previous = await db.get("profiles", session.crew_id);
    const record: ProfileRecord = {
      crew_id: session.crew_id,
      display_name: previous?.display_name ?? session.crew_id,
      token: session.token,
      role: session.role,
      expires_at: session.expires_at,
      provenance: session.provenance ?? previous?.provenance ?? null,
      device_id: id,
      pin_hash: previous?.pin_hash ?? null,
      shared_device: previous?.shared_device ?? false,
      demo: false,
    };
    await db.put("profiles", record);
    await setActiveCrew(session.crew_id);
    return { ...session, demo: false };
  } catch {
    throw new Error("Logged in, but this device could not save the session. Ask for a new code if it keeps happening.");
  }
}

export class DemoBusyError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Lots of people are trying the demo right now. Retrying…");
    this.name = "DemoBusyError";
    this.retryAfterMs = retryAfterMs;
  }
}

export async function loginDemo(role: "astronaut" | "flight_medical_officer"): Promise<SessionInfo> {
  const id = await deviceId();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, device_id: id }),
    });
  } catch {
    throw new Error("Can't reach the server. Check the connection and try the demo again.");
  }
  if (res.status === 404) throw new Error("Demo login is switched off on this server.");
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After"));
    throw new DemoBusyError(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000);
  }
  if (!res.ok) throw new Error("Something went wrong. Try again.");
  const session = (await res.json()) as SessionInfo;
  const db = await deviceDb();
  const previous = await db.get("profiles", session.crew_id);
  const record: ProfileRecord = {
    crew_id: session.crew_id,
    display_name: previous?.display_name ?? session.crew_id,
    token: session.token,
    role: session.role,
    expires_at: session.expires_at,
    provenance: session.provenance ?? "synthetic",
    device_id: id,
    pin_hash: previous?.pin_hash ?? null,
    shared_device: previous?.shared_device ?? false,
    demo: true,
  };
  await db.put("profiles", record);
  await setActiveCrew(session.crew_id);
  return { ...session, demo: true };
}

export async function pullHistory(crewId: string, token: string): Promise<void> {
  const db = await profileDb(crewId);
  let mSince: string | null = null;
  let rSince: string | null = null;
  for (let page = 0; page < 20; page++) {
    const body = await getSync(token, mSince, rSince);
    for (const item of body.measurements) await db.put("measurements", item as Measurement);
    for (const item of body.results) await db.put("results", parseSyncResult(item as Record<string, unknown>));
    if (Array.isArray(body.reports)) {
      for (const item of body.reports) await db.put("reports", item as Report);
    }
    mSince = body.measurements_cursor;
    rSince = body.results_cursor;
    if (!mSince && !rSince) break;
  }
}

function parseSyncResult(row: Record<string, unknown>): Result {
  const { per_measure_json, model_advice_json, ...rest } = row as Record<string, unknown> & {
    per_measure_json?: string;
    model_advice_json?: string | null;
  };
  return {
    ...(rest as unknown as Result),
    per_measure: typeof per_measure_json === "string" ? (JSON.parse(per_measure_json) as Result["per_measure"]) : [],
    model_advice: typeof model_advice_json === "string" && model_advice_json ? (JSON.parse(model_advice_json) as Result["model_advice"]) : null,
  };
}

export async function logout(crewId: string): Promise<void> {
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  if (profile) {
    await db.put("profiles", { ...profile, token: null, role: null, expires_at: null });
  }
  const active = await db.get("settings", "active_crew");
  if (active && active.value === crewId) {
    await db.put("settings", { key: "active_crew", value: "" });
  }
}

export async function setActiveCrew(crewId: string): Promise<void> {
  const db = await deviceDb();
  await db.put("settings", { key: "active_crew", value: crewId });
  await db.put("settings", { key: "last_active", value: new Date().toISOString() });
}

export async function touchActivity(): Promise<void> {
  const db = await deviceDb();
  await db.put("settings", { key: "last_active", value: new Date().toISOString() });
}

export async function lastActivity(): Promise<string | null> {
  const db = await deviceDb();
  const row = await db.get("settings", "last_active");
  return typeof row?.value === "string" && row.value ? row.value : null;
}

export const SHARED_IDLE_MS = 30 * 60 * 1000;

/**
 * The single source of truth for the active crew member: the `?crew=` URL
 * value when it has a valid session on this device, otherwise the stored
 * active crew (set on login and cleared on logout or expiry). On a shared
 * device idle more than 30 minutes, both the URL and the stored crew are
 * ignored so the next person unlocks with the profile PIN instead.
 */
export async function getActiveCrewId(urlCrew: string | null): Promise<string | null> {
  const db = await deviceDb();
  if (await isSharedDevice()) {
    const last = await lastActivity();
    if (!last || Date.now() - Date.parse(last) > SHARED_IDLE_MS) {
      await db.put("settings", { key: "active_crew", value: "" });
      return null;
    }
  }
  if (urlCrew) {
    const session = await getSession(urlCrew);
    if (session) return urlCrew;
  }
  const stored = await db.get("settings", "active_crew");
  const crewId = typeof stored?.value === "string" && stored.value ? stored.value : null;
  if (!crewId) return null;
  const session = await getSession(crewId);
  if (session) return crewId;
  await db.put("settings", { key: "active_crew", value: "" });
  return null;
}

export async function hasActiveSession(): Promise<boolean> {
  for (const profile of await listProfiles()) {
    if (await getSession(profile.crew_id)) return true;
  }
  return false;
}

export async function getSession(crewId: string): Promise<SessionInfo | null> {
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  if (!profile?.token || !profile.expires_at) return null;
  if (Date.parse(profile.expires_at) <= Date.now()) return null;
  return {
    token: profile.token,
    crew_id: profile.crew_id,
    role: profile.role ?? "astronaut",
    expires_at: profile.expires_at,
    provenance: profile.provenance ?? "real",
    demo: profile.demo ?? false,
  };
}

export async function listProfiles(): Promise<ProfileRecord[]> {
  const db = await deviceDb();
  return db.getAll("profiles");
}

export async function setPin(crewId: string, pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  const base: ProfileRecord = profile ?? {
    crew_id: crewId,
    display_name: crewId,
    token: null,
    role: null,
    expires_at: null,
    provenance: null,
    device_id: await deviceId(),
    pin_hash: null,
    shared_device: false,
  };
  await db.put("profiles", { ...base, pin_hash: await sha256Hex(`starplus-pin:${await deviceSalt()}:${pin}`) });
}

export async function checkPin(crewId: string, pin: string): Promise<boolean> {
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  if (!profile?.pin_hash) return false;
  return profile.pin_hash === (await sha256Hex(`starplus-pin:${await deviceSalt()}:${pin}`));
}
