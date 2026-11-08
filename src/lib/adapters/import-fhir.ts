import { lookupMeasure, type Measurement, type Phase, type Provenance, type Setting } from "@starplus/core";

export interface FhirImportContext {
  crewId: string;
  deviceId?: string;
  measuredAt?: string;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
  provenance?: Provenance;
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
}

interface UnitMapping {
  canonical: string;
  aliases: string[];
}

const LOINC_TO_METRIC: Record<string, { code: string; units: UnitMapping[]; convert?: (value: number, unit: string) => { value: number; unit: string } }> = {
  "8867-4": { code: "heart_rate", units: [{ canonical: "bpm", aliases: ["bpm", "beats/min", "beats/minute"] }] },
  "8480-6": { code: "blood_pressure_systolic", units: [{ canonical: "mmHg", aliases: ["mmhg", "mm[h g]", "mm[Hg]"] }] },
  "8462-4": { code: "blood_pressure_diastolic", units: [{ canonical: "mmHg", aliases: ["mmhg", "mm[h g]", "mm[Hg]"] }] },
  "2708-6": { code: "oxygen_saturation", units: [{ canonical: "%", aliases: ["%", "percent", "pct"] }] },
  "8310-5": {
    code: "temperature_c",
    units: [{ canonical: "°C", aliases: ["°c", "cel", "celsius", "c"] }],
    convert: (value, unit) => {
      const normalized = unit.toLowerCase().replace(/[°\s]/g, "");
      if (["f", "fahrenheit", "fahrenhet", "degf"].includes(normalized)) return { value: ((value - 32) * 5) / 9, unit: "°C" };
      return { value, unit };
    },
  },
  "9279-1": { code: "respiratory_rate", units: [{ canonical: "/min", aliases: ["/min", "breaths/min", "breaths/minute", "br/min"] }] },
  "2339-0": {
    code: "blood_glucose",
    units: [{ canonical: "mg/dL", aliases: ["mg/dl", "mg/dl "] }],
    convert: (value, unit) => {
      const normalized = unit.toLowerCase().replace(/\s/g, "");
      if (normalized === "mmol/l" || normalized === "mmol/litre") return { value: value * 18.01559, unit: "mg/dL" };
      return { value, unit };
    },
  },
};

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
    const coding = observation.code?.coding ?? [];
    const loinc = coding.map((entry) => String(entry.code ?? "")).find((code) => LOINC_TO_METRIC[code] !== undefined);
    if (!loinc) {
      rejected.push({ index, reason: "no supported LOINC code in Observation.code" });
      return;
    }
    const mapping = LOINC_TO_METRIC[loinc];
    const rawValue = observation.valueQuantity?.value;
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) {
      rejected.push({ index, reason: "missing or non-numeric valueQuantity.value" });
      return;
    }
    const unitRaw = String(observation.valueQuantity?.unit ?? "");
    const unitEntry = mapping.units.find((entry) => entry.aliases.some((alias) => alias.toLowerCase() === unitRaw.trim().toLowerCase()));
    if (!unitEntry && !mapping.convert) {
      rejected.push({ index, reason: `unsupported unit '${unitRaw}'` });
      return;
    }
    const converted = mapping.convert ? mapping.convert(value, unitRaw) : { value, unit: unitEntry!.canonical };
    const measure = lookupMeasure(mapping.code);
    if (!measure) {
      rejected.push({ index, reason: "unknown metric" });
      return;
    }
    let measuredAt = defaultMeasuredAt;
    if (typeof observation.effectiveDateTime === "string" && observation.effectiveDateTime) {
      const parsed = Date.parse(observation.effectiveDateTime);
      if (Number.isNaN(parsed)) {
        rejected.push({ index, reason: "invalid effectiveDateTime" });
        return;
      }
      measuredAt = new Date(observation.effectiveDateTime).toISOString();
    }
    records.push({
      client_id: crypto.randomUUID(),
      crew_id: context.crewId,
      metric: mapping.code,
      value_num: converted.value,
      value_text: null,
      unit: measure.unit,
      measured_at: measuredAt,
      received_at: "",
      source: "import",
      device_id: context.deviceId ?? "fhir-import",
      capture_id: null,
      is_estimate: 0,
      confirmed_by_user: 0,
      provenance: context.provenance ?? "real",
      setting: context.setting ?? "iss",
      phase: context.phase ?? "inflight",
      phase_day: context.phaseDay ?? null,
      supersedes_client_id: null,
      voided: 0,
      catalog_version: "1",
      schema_version: 1,
    });
  });
  return { records, rejected };
}
