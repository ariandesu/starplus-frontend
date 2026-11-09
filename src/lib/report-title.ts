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

/** Own-report title: "<Kind> · <date> · <status>" — never a raw ID. */
export function ownReportTitle(kind: string, iso: string, status: string): string {
  return `${kindLabel(kind)} · ${shortDate(iso)} · ${status}`;
}
