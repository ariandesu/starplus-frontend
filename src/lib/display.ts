/** Display formatting only. Stored values never change. */

const WHOLE = new Set(["bpm", "mmHg", "%", "ms", "kcal", "min", "/min", "mg/dL", "score", ""]);
const ONE_DECIMAL = new Set(["°C", "h", "L", "kg", "mSv"]);

export function formatMetricValue(metric: string, value: number | string | null): string {
  if (value === null || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  if (metric === "urine_specific_gravity") return numeric.toFixed(3);
  if (metric === "temperature_c" || metric === "sleep_hours" || metric === "body_mass" || metric === "radiation_dose") {
    return numeric.toFixed(1);
  }
  if (metric === "water_intake") return numeric.toFixed(1);
  return String(Math.round(numeric));
}

export function unitDecimals(unit: string): number {
  if (ONE_DECIMAL.has(unit)) return 1;
  if (WHOLE.has(unit)) return 0;
  return 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One local format everywhere: "Thu 12 Nov, 00:10". */
export function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const weekday = WEEKDAYS[date.getDay()];
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${weekday} ${day} ${month}, ${hours}:${minutes}`;
}
