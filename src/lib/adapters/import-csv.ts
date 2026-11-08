import { CATALOG, lookupMeasure, type Measurement, type Phase, type Provenance, type Setting } from "@starplus/core";

export interface CsvImportContext {
  crewId: string;
  deviceId?: string;
  measuredAt?: string;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
  provenance?: Provenance;
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
  const mapped = headers.map((header) => {
    if (TIMESTAMP_COLUMNS.has(header) || CREW_COLUMNS.has(header)) return null;
    // Canonical catalog codes only: aliases such as body_weight_lb carry a
    // different unit than the canonical measure, so they must not match.
    if (CATALOG.measures.some((measure) => measure.code === header)) return header;
    const mappedCode = SYNTHETIC_COLUMNS[header];
    if (mappedCode && lookupMeasure(mappedCode)) return mappedCode;
    return null;
  });
  if (!mapped.some((code) => code !== null)) {
    return { records, rejected: [{ row: 0, reason: "no mapped metric columns in the header" }] };
  }
  const defaultMeasuredAt = context.measuredAt ?? new Date().toISOString();
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 1;
    const crewId = crewIndex >= 0 && row[crewIndex] ? row[crewIndex] : context.crewId;
    let measuredAt = defaultMeasuredAt;
    if (timestampIndex >= 0 && row[timestampIndex]) {
      if (!isValidTimestamp(row[timestampIndex])) {
        rejected.push({ row: rowNumber, column: headers[timestampIndex], reason: "invalid timestamp" });
        continue;
      }
      measuredAt = new Date(row[timestampIndex]).toISOString();
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
        crew_id: crewId,
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
        provenance: context.provenance ?? "real",
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
    records.push(...rowRecords);
  }
  return { records, rejected };
}
