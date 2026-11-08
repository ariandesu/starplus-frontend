import { lookupMeasure, type Measurement, type Phase, type Provenance, type Setting } from "@starplus/core";
import { validateRecord } from "./validate";

const BLOOD_PRESSURE_PANEL = "85354-9";

export interface FhirImportContext {
  crewId: string;
  provenance: Provenance;
  deviceId?: string;
  measuredAt?: string;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
}

export interface FhirImportResult {
  records: Measurement[];
  rejected: Array<{ index: number; reason: string }>;
}

interface FhirQuantity {
  value?: unknown;
  unit?: unknown;
}

interface FhirObservation {
  resourceType?: string;
  status?: string;
  code?: { coding?: Array<{ code?: unknown; display?: unknown }>; text?: unknown };
  valueQuantity?: FhirQuantity;
  effectiveDateTime?: unknown;
  component?: FhirObservation[];
}

/** Accepted units per metric. UCUM code (`valueQuantity.code`) is read first, then `unit`. */
interface MetricMapping {
  code: string;
  unit: string;
  accept: string[];
}

const LOINC_TO_METRIC: Record<string, MetricMapping> = {
  "8867-4": { code: "heart_rate", unit: "bpm", accept: ["bpm", "beats/min", "beats/minute"] },
  "8480-6": { code: "blood_pressure_systolic", unit: "mmHg", accept: ["mmhg", "mm[hg]", "mm hg"] },
  "8462-4": { code: "blood_pressure_diastolic", unit: "mmHg", accept: ["mmhg", "mm[hg]", "mm hg"] },
  "2708-6": { code: "oxygen_saturation", unit: "%", accept: ["%", "percent", "pct"] },
  "8310-5": {
    code: "temperature_c",
    unit: "°C",
    accept: ["cel", "°c", "c", "celsius", "[degf]", "degf", "°f", "f", "fahrenheit"],
  },
  "9279-1": { code: "respiratory_rate", unit: "/min", accept: ["/min", "br/min", "breaths/min", "breaths/minute"] },
  "2339-0": {
    code: "blood_glucose",
    unit: "mg/dL",
    accept: ["mg/dl", "mmol/l", "mmol/litre"],
  },
};

function normalizeUnit(raw: unknown): string {
  return String(raw ?? "").trim();
}

function matchUnit(raw: string, accepted: string[]): boolean {
  const lowered = raw.toLowerCase();
  return accepted.some((name) => name.toLowerCase() === lowered);
}

function convertValue(code: string, value: number, unit: string): number | null {
  const lowered = unit.toLowerCase().replace(/[°\s]/g, "");
  if (code === "temperature_c") {
    if (["cel", "c", "celsius"].includes(lowered)) return value;
    if (["[degf]", "degf", "f", "fahrenheit"].includes(lowered)) return ((value - 32) * 5) / 9;
    return null;
  }
  if (code === "blood_glucose") {
    if (lowered === "mg/dl") return value;
    if (lowered === "mmol/l" || lowered === "mmol/litre") return value * 18.01559;
    return null;
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function toObservations(input: unknown): FhirObservation[] {
  if (Array.isArray(input)) return input.filter((item) => asRecord(item) !== null) as FhirObservation[];
  const root = asRecord(input);
  if (!root) return [];
  if (root.resourceType === "Bundle" && Array.isArray(root.entry)) {
    const observations: FhirObservation[] = [];
    for (const entry of root.entry) {
      const resource = asRecord(entry)?.resource ?? entry;
      const observation = asRecord(resource);
      if (observation && (observation.resourceType === undefined || observation.resourceType === "Observation")) {
        observations.push(observation as FhirObservation);
      }
    }
    return observations;
  }
  if (root.resourceType === undefined || root.resourceType === "Observation") return [root as FhirObservation];
  return [];
}

export function importFhir(input: unknown, context: FhirImportContext): FhirImportResult {
  const records: Measurement[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  const observations = toObservations(input);
  const defaultMeasuredAt = context.measuredAt ?? new Date().toISOString();
  observations.forEach((observation, index) => {
    if (observation.status !== undefined && !["final", "amended", "corrected"].includes(observation.status)) {
      return;
    }
    const coding = observation.code?.coding ?? [];
    const codes = coding.map((entry) => String(entry.code ?? ""));
    if (codes.includes(BLOOD_PRESSURE_PANEL) || (!codes.some((code) => LOINC_TO_METRIC[code] !== undefined) && observation.component !== undefined)) {
      importBloodPressurePanel(observation, index, context, defaultMeasuredAt, records, rejected);
      return;
    }
    const loinc = codes.find((code) => LOINC_TO_METRIC[code] !== undefined);
    if (!loinc) {
      rejected.push({ index, reason: "no supported LOINC code in Observation.code" });
      return;
    }
    const made = makeRecord(observation, loinc, undefined, index, context, defaultMeasuredAt);
    if ("rejected" in made) {
      rejected.push(made.rejected);
      return;
    }
    records.push(made.record);
  });
  return { records, rejected };
}

function observationUnit(observation: FhirObservation): string {
  const quantity = observation.valueQuantity ?? {};
  const raw = quantity as Record<string, unknown>;
  return normalizeUnit(raw.code ?? raw.unit);
}

/** Blood-pressure panels (LOINC 85354-9) with systolic/diastolic components share one capture_id. */
function importBloodPressurePanel(
  observation: FhirObservation,
  index: number,
  context: FhirImportContext,
  defaultMeasuredAt: string,
  records: Measurement[],
  rejected: Array<{ index: number; reason: string }>
): void {
  const components = Array.isArray(observation.component) ? observation.component : [];
  const captureId = crypto.randomUUID();
  const panelTime = typeof observation.effectiveDateTime === "string" ? observation.effectiveDateTime : undefined;
  const made: Measurement[] = [];
  for (const component of components) {
    const coding = component.code?.coding ?? [];
    const loinc = coding.map((entry) => String(entry.code ?? "")).find((code) => LOINC_TO_METRIC[code] !== undefined);
    if (loinc !== "8480-6" && loinc !== "8462-4") continue;
    const madeOne = makeRecord(
      { ...component, effectiveDateTime: component.effectiveDateTime ?? panelTime },
      loinc!,
      captureId,
      index,
      context,
      defaultMeasuredAt
    );
    if ("rejected" in madeOne) {
      rejected.push(madeOne.rejected);
      return;
    }
    made.push(madeOne.record);
  }
  if (made.length === 0) {
    rejected.push({ index, reason: "blood pressure panel has no systolic/diastolic components" });
    return;
  }
  records.push(...made);
}

function makeRecord(
  observation: FhirObservation,
  loinc: string,
  captureId: string | undefined,
  index: number,
  context: FhirImportContext,
  defaultMeasuredAt: string
): { record: Measurement } | { rejected: { index: number; reason: string } } {
  const reject = (reason: string) => ({ rejected: { index, reason } });
  const mapping = LOINC_TO_METRIC[loinc];
  const rawValue = observation.valueQuantity?.value;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(value)) return reject("missing or non-numeric valueQuantity.value");
  const unitRaw = observationUnit(observation);
  if (!matchUnit(unitRaw, mapping.accept)) return reject(`unsupported unit '${unitRaw}'`);
  const converted = convertValue(mapping.code, value, unitRaw);
  if (converted === null) return reject(`unsupported unit '${unitRaw}'`);
  const measure = lookupMeasure(mapping.code);
  if (!measure) return reject("unknown metric");
  let measuredAt = defaultMeasuredAt;
  if (typeof observation.effectiveDateTime === "string" && observation.effectiveDateTime) {
    const parsed = Date.parse(observation.effectiveDateTime);
    if (Number.isNaN(parsed)) return reject("invalid effectiveDateTime");
    measuredAt = new Date(observation.effectiveDateTime).toISOString();
  }
  const record: Measurement = {
    client_id: crypto.randomUUID(),
    crew_id: context.crewId,
    metric: mapping.code,
    value_num: converted,
    value_text: null,
    unit: measure.unit,
    measured_at: measuredAt,
    received_at: "",
    source: "import",
    device_id: context.deviceId ?? "fhir-import",
    capture_id: captureId ?? null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: context.provenance,
    setting: context.setting ?? "iss",
    phase: context.phase ?? "inflight",
    phase_day: context.phaseDay ?? null,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
  };
  const checked = validateRecord(record);
  if (!checked.ok) return reject(checked.reason);
  return { record };
}
