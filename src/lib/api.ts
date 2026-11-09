// Authenticated data access for the STAR PLUS backend (Cloudflare Workers + D1).
// Errors throw ApiError (status 0 means the network itself failed) so callers
// can surface them to the outbox instead of treating them as empty data.

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "https://starplus-backend.shareflow.workers.dev";

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

export function getSync(token: string, sinceMeasurements?: string | null, sinceResults?: string | null) {
  const params = new URLSearchParams();
  if (sinceMeasurements) params.set("since_measurements", sinceMeasurements);
  if (sinceResults) params.set("since_results", sinceResults);
  const query = params.size > 0 ? `?${params}` : "";
  return apiFetch<{
    measurements: unknown[];
    results: unknown[];
    reports_status: unknown[];
    reports: unknown[];
    cursor: string | null;
    measurements_cursor: string | null;
    results_cursor: string | null;
  }>(`/api/sync${query}`, token);
}

export function postReport(token: string, report: unknown) {
  return apiFetch<{ report: unknown; duplicate: boolean }>("/api/reports", token, {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function getReports(token: string, since?: string | null, order?: "asc" | "desc") {
  const params = new URLSearchParams();
  if (since) params.set("since", since);
  if (order) params.set("order", order);
  const query = params.size > 0 ? `?${params}` : "";
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

export function getCrewProgress(token: string) {
  return apiFetch<{ window_days: number; readiness_pct: number }>("/api/crew/progress", token);
}

export async function getAttachment(token: string, id: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/attachments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : "network failed");
  }
  if (!res.ok) throw new ApiError(res.status, `attachment fetch failed with ${res.status}`);
  return res.blob();
}
