const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function kindLabel(kind: string): string {
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : kind;
}

export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** Inbox title: "<Kind> · <crew name> · <date>" — never a raw ID. */
export function inboxTitle(kind: string, crewName: string, iso: string): string {
  return `${kindLabel(kind)} · ${crewName} · ${shortDate(iso)}`;
}

/** Emergency scenario ids recorded in report payloads, with their display labels. */
export const SCENARIO_LABELS: Record<string, string> = {
  unresponsive: "Someone else, not responding",
  "chest-pain": "Me, chest pain",
  choking: "Choking",
  bleeding: "Severe bleeding",
  burns: "Burns",
  anaphylaxis: "Allergic reaction",
  "low-blood-sugar": "Low blood sugar",
  fainting: "Fainting",
  eva: "Spacewalk emergency",
};

export function scenarioLabel(scenarioId: string | null | undefined): string | null {
  if (!scenarioId) return null;
  return SCENARIO_LABELS[scenarioId] ?? null;
}

/** The scenario label recorded in an emergency report payload, if it is a known one. */
export function reportScenario(payload_json: string): string | null {
  try {
    const payload = JSON.parse(payload_json) as { scenario?: unknown };
    return scenarioLabel(typeof payload.scenario === "string" ? payload.scenario : null);
  } catch {
    return null;
  }
}

/** Own-report title: "<Kind> · <date> · <status>" — never a raw ID. */
export function ownReportTitle(kind: string, iso: string, status: string): string {
  return `${kindLabel(kind)} · ${shortDate(iso)} · ${status}`;
}
