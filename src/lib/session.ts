import { deviceDb, profileDb, type ProfileRecord } from "./db";
import { getSync } from "./api";
import {
  AuthFailure,
  fetchServerSession,
  passwordSignIn,
  redeemAccessCode,
  remoteSignOut,
  type ServerSession,
} from "./auth-client";
import { DEMO_PASSWORD, demoCardForRole } from "./demo-accounts";
import type { Measurement, Report, Result } from "@starplus/core";

export interface SessionInfo {
  token: string;
  crew_id: string;
  name?: string;
  username?: string | null;
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

function toSessionInfo(session: ServerSession): SessionInfo {
  return {
    token: session.token,
    crew_id: session.crew_id,
    name: session.name,
    username: session.username,
    role: session.role,
    expires_at: session.expires_at,
    provenance: session.provenance,
    demo: session.demo,
  };
}

/** Writes a signed-in session into the device profile and (optionally) activates it. */
async function saveProfile(session: ServerSession, activate = true): Promise<void> {
  const db = await deviceDb();
  const previous = await db.get("profiles", session.crew_id);
  const record: ProfileRecord = {
    crew_id: session.crew_id,
    display_name: session.name,
    token: session.token,
    role: session.role,
    expires_at: session.expires_at,
    provenance: session.provenance,
    device_id: previous?.device_id ?? (await deviceId()),
    pin_hash: previous?.pin_hash ?? null,
    shared_device: previous?.shared_device ?? false,
    demo: session.demo,
    username: session.username,
  };
  await db.put("profiles", record);
  if (activate) await setActiveCrew(session.crew_id);
}

/** Signs in with a username and password (Better Auth), storing the bearer token. */
export async function loginWithPassword(username: string, password: string): Promise<SessionInfo> {
  const shared = await isSharedDevice();
  const { session } = await passwordSignIn(username, password, { shared });
  await saveProfile(session);
  return toSessionInfo(session);
}

/** Redeems an access code and signs the new username/password account in. */
export async function redeemCode(accessCode: string, username: string, password: string): Promise<SessionInfo> {
  const shared = await isSharedDevice();
  const { session } = await redeemAccessCode(accessCode, username, password, { shared });
  await saveProfile(session);
  return toSessionInfo(session);
}

export class DemoBusyError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super("Lots of people are trying the demo right now. Retrying…");
    this.name = "DemoBusyError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** One-tap demo sign-in with that role's shared demo credentials. */
export async function loginDemo(
  role: "astronaut" | "flight_medical_officer" | "mission_control"
): Promise<SessionInfo> {
  const card = demoCardForRole(role);
  if (!DEMO_PASSWORD) throw new Error("Demo login is not configured in this build.");
  try {
    const shared = await isSharedDevice();
    const { session } = await passwordSignIn(card.username, DEMO_PASSWORD, { shared });
    await saveProfile(session);
    return toSessionInfo(session);
  } catch (error) {
    if (error instanceof AuthFailure && error.status === 429) {
      throw new DemoBusyError(error.retryAfterMs ?? 5000);
    }
    throw error;
  }
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

/** Signs out on the server (best effort offline), then clears the device. */
export async function logout(crewId: string): Promise<void> {
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  if (profile?.token) await remoteSignOut(profile.token);
  if (profile) {
    await db.put("profiles", { ...profile, token: null, role: null, expires_at: null });
  }
  const active = await db.get("settings", "active_crew");
  if (active && active.value === crewId) {
    await db.put("settings", { key: "active_crew", value: "" });
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("active-crew-changed"));
  }
}

export async function setActiveCrew(crewId: string): Promise<void> {
  const db = await deviceDb();
  const current = await db.get("settings", "active_crew");
  await db.put("settings", { key: "active_crew", value: crewId });
  await db.put("settings", { key: "last_active", value: new Date().toISOString() });
  if (current?.value !== crewId && typeof window !== "undefined") {
    window.dispatchEvent(new Event("active-crew-changed"));
  }
}

/** Adopt a valid on-device session as the active crew (profile picker). */
export async function adoptCrew(crewId: string): Promise<void> {
  await setActiveCrew(crewId);
}

export interface AdoptableCrew {
  crew_id: string;
  display_name: string;
  role: string;
}

/** Profiles with a live session on this device, newest expiry first. */
export async function listAdoptableCrews(): Promise<AdoptableCrew[]> {
  const found: Array<AdoptableCrew & { expires_at: string }> = [];
  for (const profile of await listProfiles()) {
    if (!profile.expires_at) continue;
    const session = await getSession(profile.crew_id);
    if (!session) continue;
    found.push({
      crew_id: profile.crew_id,
      display_name: profile.display_name,
      role: session.role,
      expires_at: profile.expires_at,
    });
  }
  found.sort((a, b) => (a.expires_at < b.expires_at ? 1 : -1));
  return found.map(({ crew_id, display_name, role }) => ({ crew_id, display_name, role }));
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

export type ActiveCrewState = string | null | "choose";

/**
 * The single source of truth for the active crew member: the `?crew=` URL
 * value when it has a valid session on this device (stored as the active
 * crew), otherwise the stored active crew (set on login and cleared on
 * logout or expiry). When neither is usable, a single valid on-device
 * session is adopted; several valid sessions return "choose" for the
 * profile picker. On a shared device idle more than 30 minutes, both the
 * URL and the stored crew are ignored so the next person unlocks with the
 * profile PIN instead.
 */
export async function getActiveCrewId(urlCrew: string | null): Promise<ActiveCrewState> {
  const db = await deviceDb();
  if (await isSharedDevice()) {
    const last = await lastActivity();
    if (!last || Date.now() - Date.parse(last) > SHARED_IDLE_MS) {
      await db.put("settings", { key: "active_crew", value: "" });
      return null;
    }
  }
  // A stored token counts even when locally expired: the session layer renews
  // it (demo, silently) or shows the expired view (real), both of which need
  // the crew id. Adoption below still only takes unexpired sessions.
  if (urlCrew) {
    const profile = await getProfile(urlCrew);
    if (profile?.token) {
      await setActiveCrew(urlCrew);
      return urlCrew;
    }
  }
  const stored = await db.get("settings", "active_crew");
  const crewId = typeof stored?.value === "string" && stored.value ? stored.value : null;
  if (crewId) {
    const profile = await getProfile(crewId);
    if (profile?.token) return crewId;
    await db.put("settings", { key: "active_crew", value: "" });
  }
  const adoptable = await listAdoptableCrews();
  if (adoptable.length === 1) {
    await setActiveCrew(adoptable[0].crew_id);
    return adoptable[0].crew_id;
  }
  if (adoptable.length > 1) return "choose";
  return null;
}

export async function hasActiveSession(): Promise<boolean> {
  for (const profile of await listProfiles()) {
    if (await getSession(profile.crew_id)) return true;
  }
  return false;
}

export async function getProfile(crewId: string): Promise<ProfileRecord | null> {
  const db = await deviceDb();
  return (await db.get("profiles", crewId)) ?? null;
}

function localSession(profile: ProfileRecord): SessionInfo | null {
  if (!profile.token || !profile.expires_at) return null;
  if (Date.parse(profile.expires_at) <= Date.now()) return null;
  return {
    token: profile.token,
    crew_id: profile.crew_id,
    name: profile.display_name,
    username: profile.username ?? null,
    role: profile.role ?? "astronaut",
    expires_at: profile.expires_at,
    provenance: profile.provenance ?? "real",
    demo: profile.demo ?? false,
  };
}

export async function getSession(crewId: string): Promise<SessionInfo | null> {
  const profile = await getProfile(crewId);
  return profile ? localSession(profile) : null;
}

export async function listProfiles(): Promise<ProfileRecord[]> {
  const db = await deviceDb();
  return db.getAll("profiles");
}

export type RefreshOutcome =
  | { status: "active"; session: SessionInfo }
  | { status: "expired"; crew_id: string; name: string; username: string | null; demo: boolean }
  | { status: "none" };

function expiredOutcome(profile: ProfileRecord): RefreshOutcome {
  return {
    status: "expired",
    crew_id: profile.crew_id,
    name: profile.display_name,
    username: profile.username ?? null,
    demo: profile.demo ?? false,
  };
}

async function silentDemoReSignIn(profile: ProfileRecord): Promise<RefreshOutcome | null> {
  if (!profile.demo || !profile.username || !DEMO_PASSWORD) return null;
  try {
    const { session } = await passwordSignIn(profile.username, DEMO_PASSWORD, {
      shared: profile.shared_device,
    });
    await saveProfile(session, false);
    if (session.role === "astronaut") {
      await pullHistory(session.crew_id, session.token).catch(() => undefined);
    }
    return { status: "active", session: toSessionInfo(session) };
  } catch {
    return null;
  }
}

/**
 * On app open: renew the session while in use. Online, the server is the
 * source of truth (and slides the expiry). An expired or rejected demo
 * session signs in again silently with that role's demo credentials; a real
 * one comes back "expired" so the page can ask for a sign-in. Offline, the
 * stored session is used until it expires.
 */
export async function refreshSession(crewId: string): Promise<RefreshOutcome> {
  const profile = await getProfile(crewId);
  if (!profile?.token) return { status: "none" };

  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (online) {
    try {
      const live = await fetchServerSession(profile.token);
      if (live) {
        await saveProfile({ ...live, username: live.username ?? profile.username ?? null }, false);
        return { status: "active", session: toSessionInfo(live) };
      }
      const renewed = await silentDemoReSignIn(profile);
      return renewed ?? expiredOutcome(profile);
    } catch {
      // Network failed; fall back to the stored session below.
    }
  }

  const local = localSession(profile);
  if (local) return { status: "active", session: local };
  const renewed = await silentDemoReSignIn(profile);
  return renewed ?? expiredOutcome(profile);
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
