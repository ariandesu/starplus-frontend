/** Key vitals shown first on cards and charts, in this order. */
export const KEY_VITALS = [
  "heart_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "oxygen_saturation",
  "temperature_c",
  "respiratory_rate",
];

const STATUS_RANK: Record<string, number> = {
  critical: 0,
  watch: 1,
  nominal: 2,
  insufficient: 3,
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 4;
}

function keyIndex(metric: string): number {
  const index = KEY_VITALS.indexOf(metric);
  return index === -1 ? KEY_VITALS.length : index;
}

/**
 * Non-nominal measures first (critical, watch, nominal, insufficient, other),
 * then the key vitals in app order, then everything else alphabetically.
 */
export function sortVitals<T extends { metric: string; status: string }>(vitals: T[]): T[] {
  return [...vitals].sort((a, b) => {
    const rank = statusRank(a.status) - statusRank(b.status);
    if (rank !== 0) return rank;
    const key = keyIndex(a.metric) - keyIndex(b.metric);
    if (key !== 0) return key;
    return a.metric < b.metric ? -1 : 1;
  });
}
