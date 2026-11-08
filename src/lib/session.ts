import { deviceDb, type ProfileRecord } from "./db";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend.shareflow.workers.dev";

export interface SessionInfo {
  token: string;
  crew_id: string;
  role: string;
  expires_at: string;
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
  const res = await fetch(`${API_BASE}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: accessCode, device_id: id, ...(shared ? { shared: true } : {}) }),
  });
  if (!res.ok) throw new Error("Login failed");
  const session = (await res.json()) as SessionInfo;
  const db = await deviceDb();
  const previous = await db.get("profiles", session.crew_id);
  const record: ProfileRecord = {
    crew_id: session.crew_id,
    display_name: previous?.display_name ?? session.crew_id,
    token: session.token,
    role: session.role,
    expires_at: session.expires_at,
    device_id: id,
    pin_hash: previous?.pin_hash ?? null,
    shared_device: previous?.shared_device ?? false,
  };
  await db.put("profiles", record);
  return session;
}

export async function logout(crewId: string): Promise<void> {
  const db = await deviceDb();
  const profile = await db.get("profiles", crewId);
  if (!profile) return;
  await db.put("profiles", { ...profile, token: null, role: null, expires_at: null });
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
