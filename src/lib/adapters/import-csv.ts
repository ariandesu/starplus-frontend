import { CATALOG, lookupMeasure, type Measurement, type Phase, type Provenance, type Setting } from "@starplus/core";
import { validateRecord } from "./validate";

export interface CsvImportContext {
  crewId: string;
  provenance: Provenance;
  deviceId?: string;
  measuredAt?: string;
  /** Explicit per-header mapping: canonical catalog code, or null to ignore. Defaults to auto-detect. */
  mapping?: Record<string, string | null>;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
}

export interface CsvImportResult {
  records: Measurement[];
  rejected: Array<{ row: number; column?: string; reason: string }>;
}

/** Mirrors ml/maps/synthetic.yaml so the synthetic CSV imports as-is. */
const SYNTHETIC_COLUMNS: Record<string, string> = {
  systolic_bp_mmHg: "blood_pressure_systolic",
  diastolic_bp_mmHg: "blood_pressure_diastolic",
  blood_glucose_mg_dL: "blood_glucose",
  core_body_temp_C: "temperature_c",
  heart_rate_bpm: "heart_rate",
  hrv_rmssd_ms: "hrv_rmssd",
  spo2_percent: "oxygen_saturation",
  respiratory_rate_bpm: "respiratory_rate",
  sleep_duration_h: "sleep_hours",
  sleep_quality_score_0_100: "sleep_quality",
  mood_score_0_100: "mood_score",
  physical_activity_min_per_day: "physical_activity",
  body_mass_kg: "body_mass",
  hydration_urine_specific_gravity: "urine_specific_gravity",
  stress_score_0_100: "stress_score",
};

const TIMESTAMP_COLUMNS = new Set(["measured_at", "measuredAt", "timestamp", "time", "datetime"]);
const CREW_COLUMNS = new Set(["crew_id", "crewId", "crew"]);
const DATA_SOURCE_COLUMNS = new Set(["data_source", "dataSource"]);

/** Default mapping for a header: canonical code, synthetic map, else ignore. Exported for the mapping UI. */
export function suggestColumnMapping(headers: string[]): Array<string | null> {
  return headers.map((header) => {
    if (TIMESTAMP_COLUMNS.has(header) || CREW_COLUMNS.has(header) || DATA_SOURCE_COLUMNS.has(header)) return null;
    // Canonical catalog codes only: aliases such as body_weight_lb carry a
    // different unit than the canonical measure, so they must not match.
    if (CATALOG.measures.some((measure) => measure.code === header)) return header;
    const mapped = SYNTHETIC_COLUMNS[header];
    if (mapped && lookupMeasure(mapped)) return mapped;
    return null;
  });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCsvRows(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function isValidTimestamp(raw: string): boolean {
  const parsed = Date.parse(raw);
  return !Number.isNaN(parsed);
}

export function importCsv(text: string, context: CsvImportContext): CsvImportResult {
  const records: Measurement[] = [];
  const rejected: Array<{ row: number; column?: string; reason: string }> = [];
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { records, rejected: [{ row: 0, reason: "csv needs a header row and at least one data row" }] };
  const headers = rows[0];
  const timestampIndex = headers.findIndex((header) => TIMESTAMP_COLUMNS.has(header));
  const crewIndex = headers.findIndex((header) => CREW_COLUMNS.has(header));
  const sourceIndex = headers.findIndex((header) => DATA_SOURCE_COLUMNS.has(header));
  const autoMapped = suggestColumnMapping(headers);
  const mapped = headers.map((header, columnIndex) => {
    if (TIMESTAMP_COLUMNS.has(header) || CREW_COLUMNS.has(header) || DATA_SOURCE_COLUMNS.has(header)) return null;
    if (context.mapping && header in context.mapping) {
      const override = context.mapping[header];
      if (override !== null && !lookupMeasure(override)) return null;
      return override;
    }
    return autoMapped[columnIndex];
  });
  if (!mapped.some((code) => code !== null)) {
    return { records, rejected: [{ row: 0, reason: "no mapped metric columns in the header" }] };
  }
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1;
    if (crewIndex >= 0 && row[crewIndex] && row[crewIndex] !== context.crewId) {
      rejected.push({ row: rowNumber, reason: "wrong_crew" });
      continue;
    }
    if (sourceIndex >= 0 && row[sourceIndex] && row[sourceIndex].toUpperCase() === "SYNTHETIC" && context.provenance !== "synthetic") {
      rejected.push({ row: rowNumber, column: headers[sourceIndex], reason: "provenance_mismatch" });
      continue;
    }
    let measuredAt: string | null = context.measuredAt ?? null;
    if (timestampIndex >= 0 && row[timestampIndex]) {
      if (!isValidTimestamp(row[timestampIndex])) {
        rejected.push({ row: rowNumber, column: headers[timestampIndex], reason: "invalid timestamp" });
        continue;
      }
      measuredAt = new Date(row[timestampIndex]).toISOString();
    }
    if (measuredAt === null) {
      rejected.push({ row: rowNumber, reason: "missing timestamp" });
      continue;
    }
    const captureId = crypto.randomUUID();
    let hasBloodPressurePair = false;
    const rowRecords: Measurement[] = [];
    headers.forEach((header, columnIndex) => {
      const code = mapped[columnIndex];
      if (!code) return;
      const cell = (row[columnIndex] ?? "").trim();
      if (cell === "") return;
      const value = Number(cell);
      if (!Number.isFinite(value)) {
        rejected.push({ row: rowNumber, column: header, reason: "not a number" });
        return;
      }
      const measure = lookupMeasure(code);
      if (!measure) {
        rejected.push({ row: rowNumber, column: header, reason: "unknown metric" });
        return;
      }
      rowRecords.push({
        client_id: crypto.randomUUID(),
        crew_id: context.crewId,
        metric: code,
        value_num: value,
        value_text: null,
        unit: measure.unit,
        measured_at: measuredAt,
        received_at: "",
        source: "import",
        device_id: context.deviceId ?? "csv-import",
        capture_id: null,
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
      });
      if (code === "blood_pressure_systolic" || code === "blood_pressure_diastolic") hasBloodPressurePair = true;
    });
    if (hasBloodPressurePair) {
      const hasBoth =
        rowRecords.some((record) => record.metric === "blood_pressure_systolic") &&
        rowRecords.some((record) => record.metric === "blood_pressure_diastolic");
      if (hasBoth) {
        for (const record of rowRecords) {
          if (record.metric === "blood_pressure_systolic" || record.metric === "blood_pressure_diastolic") {
            record.capture_id = captureId;
          }
        }
      }
    }
    for (const record of rowRecords) {
      const checked = validateRecord(record);
      if (!checked.ok) {
        rejected.push({ row: rowNumber, column: record.metric, reason: checked.reason });
        continue;
      }
      records.push(record);
    }
  }
  return { records, rejected };
}

export interface JsonImportRecord {
  metric?: unknown;
  value?: unknown;
  unit?: unknown;
  measured_at?: unknown;
  measuredAt?: unknown;
  crew_id?: unknown;
  crewId?: unknown;
  data_source?: unknown;
  dataSource?: unknown;
}

export interface JsonImportResult {
  records: Measurement[];
  rejected: Array<{ index: number; reason: string }>;
}

/** Non-FHIR JSON rows: [{ metric, value, unit?, measured_at?, crew_id? }], validated like CSV rows. */
export function importJsonRecords(items: unknown, context: CsvImportContext): JsonImportResult {
  const records: Measurement[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  if (!Array.isArray(items)) return { records, rejected: [{ index: -1, reason: "expected an array of records" }] };
  items.forEach((raw, index) => {
    const item = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const metric = String(item.metric ?? "");
    const measure = lookupMeasure(metric);
    if (!measure || metric !== measure.code) {
      rejected.push({ index, reason: "unknown metric" });
      return;
    }
    const crewId = typeof item.crew_id === "string" && item.crew_id ? item.crew_id : typeof item.crewId === "string" && item.crewId ? item.crewId : context.crewId;
    if (crewId !== context.crewId) {
      rejected.push({ index, reason: "wrong_crew" });
      return;
    }
    const dataSource = typeof item.data_source === "string" ? item.data_source : typeof item.dataSource === "string" ? item.dataSource : undefined;
    if (dataSource && dataSource.toUpperCase() === "SYNTHETIC" && context.provenance !== "synthetic") {
      rejected.push({ index, reason: "provenance_mismatch" });
      return;
    }
    const value = typeof item.value === "number" ? item.value : Number(item.value);
    if (!Number.isFinite(value)) {
      rejected.push({ index, reason: "not a number" });
      return;
    }
    const rawMeasured = typeof item.measured_at === "string" && item.measured_at ? item.measured_at : typeof item.measuredAt === "string" && item.measuredAt ? item.measuredAt : context.measuredAt;
    if (typeof rawMeasured !== "string" || !rawMeasured || Number.isNaN(Date.parse(rawMeasured))) {
      rejected.push({ index, reason: rawMeasured ? "invalid timestamp" : "missing timestamp" });
      return;
    }
    const unit = typeof item.unit === "string" && item.unit ? item.unit : measure.unit;
    const record: Measurement = {
      client_id: crypto.randomUUID(),
      crew_id: context.crewId,
      metric: measure.code,
      value_num: value,
      value_text: null,
      unit,
      measured_at: new Date(rawMeasured).toISOString(),
      received_at: "",
      source: "import",
      device_id: context.deviceId ?? "json-import",
      capture_id: null,
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
    if (!checked.ok) {
      rejected.push({ index, reason: checked.reason });
      return;
    }
    records.push(record);
  });
  return { records, rejected };
}
