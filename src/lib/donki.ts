export interface SepEvent {
  eventTime: string;
  instruments: string[];
}

const SEP_ENDPOINT = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP";

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** DONKI only accepts windows of 60 days or less; we ask for the last 30. */
export function buildSepUrl(now: Date = new Date()): string {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  return `${SEP_ENDPOINT}?startDate=${isoDay(start)}&endDate=${isoDay(end)}`;
}

/**
 * Defensive parse of the DONKI SEP payload. Anything unexpected yields no
 * events rather than a crash: this feed is advisory and best-effort.
 */
export function parseSepEvents(payload: unknown): SepEvent[] {
  if (!Array.isArray(payload)) return [];
  const events: SepEvent[] = [];
  for (const item of payload) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.eventTime !== "string") continue;
    const rawInstruments = Array.isArray(record.instruments) ? record.instruments : [];
    const instruments = rawInstruments
      .filter(
        (instrument): instrument is { displayName: string } =>
          typeof instrument === "object" &&
          instrument !== null &&
          typeof (instrument as { displayName?: unknown }).displayName === "string"
      )
      .map((instrument) => instrument.displayName);
    events.push({ eventTime: record.eventTime, instruments });
  }
  return events;
}

/** Live DONKI query with a hard timeout. Rejects on any failure. */
export async function fetchSepEvents(fetcher: typeof fetch = fetch): Promise<SepEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(buildSepUrl(), { signal: controller.signal });
    if (!response.ok) throw new Error(`DONKI ${response.status}`);
    return parseSepEvents(await response.json());
  } finally {
    clearTimeout(timer);
  }
}
