// Data access for the STAR PLUS backend (Cloudflare Workers + D1).
// Every fetch returns `null` on failure so the page can tell "API down" apart
// from "API up, but no rows yet".

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend.shareflow.workers.dev";

export interface Astronaut {
  id: string;
  name: string;
  role: "astronaut" | "flight_medical_officer" | "mission_control";
  status: "active" | "standby" | "off-duty";
  last_checkin: string | null;
  created_at: string;
}

export interface VitalReading {
  id: number;
  astronaut_id: string;
  heart_rate: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  oxygen_saturation: number | null;
  temperature_c: number | null;
  timestamp: string;
}

export interface WatchSignal {
  id: number;
  signal_type: string;
  astronaut_id: string;
  baseline_30d: string | null;
  moving_window_72h: string | null;
  status: "nominal" | "watch" | "critical";
  created_at: string;
  updated_at: string;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAstronauts() {
  const data = await getJson<{ astronauts: Astronaut[] }>("/api/astronauts");
  return data?.astronauts ?? null;
}

export async function fetchWatchSignals() {
  const data = await getJson<{ watch_signals: WatchSignal[] }>("/api/watch-signals");
  return data?.watch_signals ?? null;
}

export async function fetchVitals(astronautId: string) {
  const data = await getJson<{ vitals: VitalReading[] }>(
    `/api/vitals/${encodeURIComponent(astronautId)}`
  );
  return data?.vitals ?? null;
}

/** D1 stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC. */
export function parseD1Time(ts: string): Date {
  return new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
}

export function formatTimeUTC(ts: string): string {
  const d = parseD1Time(ts);
  return Number.isNaN(d.getTime())
    ? ts
    : `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function formatRelative(ts: string, now = Date.now()): string {
  const d = parseD1Time(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const mins = Math.round((now - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Turns the 72h moving-window JSON into one readable line. */
export function describeWindow(signal: WatchSignal): string {
  const type = signal.signal_type.replace(/_/g, " ");
  if (!signal.moving_window_72h) return `${type}: no 72-hour data yet.`;
  try {
    const w = JSON.parse(signal.moving_window_72h) as {
      current?: number;
      trend?: string;
      deviation_pct?: number;
    };
    const parts = [`${type}`];
    if (w.current != null) parts.push(`current ${w.current}`);
    if (w.deviation_pct != null)
      parts.push(`${w.deviation_pct > 0 ? "+" : ""}${w.deviation_pct}% vs 30-day baseline`);
    if (w.trend) parts.push(`trend ${w.trend}`);
    return parts.join(", ") + ".";
  } catch {
    return `${type}: ${signal.moving_window_72h}`;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : "network failed");
  }
  if (!res.ok) throw new ApiError(res.status, `request failed with ${res.status}`);
  return (await res.json()) as T;
}

export function postBatch(
  token: string,
  batch: { schema_version: 1; catalog_version: string; items: unknown[]; results: unknown[] }
) {
  return apiFetch<{ accepted: string[]; duplicates: string[]; rejected: unknown[]; max_items: number; retry_after?: number }>(
    "/api/measurements/batch",
    token,
    { method: "POST", body: JSON.stringify(batch) }
  );
}

export function getSync(token: string, since?: string | null) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<{ measurements: unknown[]; results: unknown[]; reports_status: unknown[]; cursor: string | null }>(
    `/api/sync${query}`,
    token
  );
}

export function postReport(token: string, report: unknown) {
  return apiFetch<{ report: unknown; duplicate: boolean }>("/api/reports", token, {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function getReports(token: string, since?: string | null) {
  const query = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiFetch<{ reports: unknown[] }>(`/api/reports${query}`, token);
}

export function ackReport(token: string, client_id: string) {
  return apiFetch<{ acknowledged: string }>("/api/reports/ack", token, {
    method: "POST",
    body: JSON.stringify({ client_id }),
  });
}

export function getCrewResults(token: string, crew_id: string, since?: string | null) {
  const params = new URLSearchParams({ crew_id });
  if (since) params.set("since", since);
  return apiFetch<{ results: unknown[]; cursor: string | null }>(`/api/crew/results?${params}`, token);
}
