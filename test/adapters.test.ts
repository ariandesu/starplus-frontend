import { describe, expect, it } from "vitest";
import { CATALOG, type Measurement } from "@starplus/core";
import { BODY_SYSTEMS, systemHasData } from "../src/components/body-map";
import { importCsv, parseCsvRows } from "../src/lib/adapters/import-csv";
import { importFhir, toObservations } from "../src/lib/adapters/import-fhir";
import { validateRecord } from "../src/lib/adapters/validate";
import { answerQuestionnaire, questionnaireQuestions } from "../src/lib/adapters/questionnaire";
import { medianExcludingFirst, reactionToRecord } from "../src/lib/adapters/reaction-test";

const SYNTHETIC_SAMPLE = [
  "record_id,astronaut_id,data_source,agency,mission_phase,systolic_bp_mmHg,diastolic_bp_mmHg,mean_arterial_pressure_mmHg,blood_glucose_mg_dL,core_body_temp_C,heart_rate_bpm,hrv_rmssd_ms,spo2_percent,respiratory_rate_bpm,sleep_duration_h,sleep_quality_score_0_100,mood_score_0_100,physical_activity_min_per_day,body_mass_kg,body_weight_lb,hydration_urine_specific_gravity,stress_score_0_100,sick/fit",
  "SYN-00001,SYN-A001,SYNTHETIC,NASA,preflight_L-90,138,72,94.0,92.2,37.07,65.9,44.8,97.5,11.6,6.25,56.2,60.3,43.2,78.57,173.22,1.0131,39.6,0",
  "SYN-00002,SYN-A001,SYNTHETIC,NASA,preflight_L-10,126,72,90.0,88.8,37.11,62.0,50.5,96.9,9.4,5.47,62.6,54.3,56.9,79.06,174.29,1.012,49.5,0",
].join("\n");

function measurement(partial: Partial<Measurement> = {}): Measurement {
  return {
    client_id: "11111111-1111-4111-8111-111111111111",
    crew_id: "test-crew",
    metric: "heart_rate",
    value_num: 72,
    value_text: null,
    unit: "bpm",
    measured_at: "2026-11-08T10:00:00Z",
    received_at: "",
    source: "manual",
    device_id: "device-1",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
    phase_day: null,
    supersedes_client_id: null,
    voided: 0,
    catalog_version: "1",
    schema_version: 1,
    ...partial,
  };
}

function fhirObs(loinc: string, value: unknown, unit: string, extra: Record<string, unknown> = {}) {
  return {
    resourceType: "Observation",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: loinc }] },
    valueQuantity: { value, unit },
    effectiveDateTime: "2026-11-08T10:00:00Z",
    ...extra,
  };
}

describe("validateRecord", () => {
  it("accepts a good record", () => {
    expect(validateRecord(measurement())).toEqual({ ok: true });
  });

  it("rejects out-of-bounds values", () => {
    expect(validateRecord(measurement({ value_num: 900 }))).toEqual({ ok: false, reason: "out_of_bounds" });
    expect(validateRecord(measurement({ value_num: 10 }))).toEqual({ ok: false, reason: "out_of_bounds" });
  });

  it("rejects a wrong unit", () => {
    expect(validateRecord(measurement({ unit: "bpm-wrong" }))).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects a timestamp more than a day in the future", () => {
    const now = Date.parse("2026-11-08T10:00:00Z");
    expect(validateRecord(measurement({ measured_at: "2030-01-01T00:00:00Z" }), now)).toEqual({
      ok: false,
      reason: "future_timestamp",
    });
    expect(validateRecord(measurement({ measured_at: "not-a-date" }), now)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects missing provenance", () => {
    expect(validateRecord(measurement({ provenance: undefined as never }))).toEqual({ ok: false, reason: "missing_provenance" });
  });

  it("rejects an unknown metric", () => {
    expect(validateRecord(measurement({ metric: "nope", unit: "x" }))).toEqual({ ok: false, reason: "unknown_metric" });
  });
});

describe("csv import", () => {
  it("imports the synthetic CSV columns as synthetic measurements", () => {
    const { records, rejected } = importCsv(SYNTHETIC_SAMPLE, {
      crewId: "csv-crew",
      provenance: "synthetic",
      measuredAt: "2026-11-08T10:00:00Z",
    });
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(30);
    const heart = records.find((record) => record.metric === "heart_rate" && record.value_num === 65.9);
    expect(heart).toMatchObject({ crew_id: "csv-crew", unit: "bpm", source: "import", provenance: "synthetic" });
    const systolic = records.find((record) => record.metric === "blood_pressure_systolic");
    const diastolic = records.find((record) => record.metric === "blood_pressure_diastolic");
    expect(systolic).toBeDefined();
    expect(diastolic).toBeDefined();
    expect(systolic!.capture_id).not.toBeNull();
    expect(systolic!.capture_id).toBe(diastolic!.capture_id);
    expect(records.filter((record) => !record.metric.startsWith("blood_pressure")).every((record) => record.capture_id === null)).toBe(true);
  });

  it("rejects a synthetic row for a non-synthetic crew", () => {
    const { records, rejected } = importCsv(SYNTHETIC_SAMPLE, {
      crewId: "csv-crew",
      provenance: "real",
      measuredAt: "2026-11-08T10:00:00Z",
    });
    expect(records).toHaveLength(0);
    expect(rejected).toEqual([
      { row: 2, column: "data_source", reason: "provenance_mismatch" },
      { row: 3, column: "data_source", reason: "provenance_mismatch" },
    ]);
  });

  it("rejects rows for another crew", () => {
    const { records, rejected } = importCsv("heart_rate,crew_id,measured_at\n72,other-crew,2026-11-08T10:00:00Z", {
      crewId: "csv-crew",
      provenance: "real",
    });
    expect(records).toHaveLength(0);
    expect(rejected).toEqual([{ row: 2, reason: "wrong_crew" }]);
  });

  it("maps catalog-code headers with per-row crew and timestamp", () => {
    const text = ["heart_rate,crew_id,measured_at", "72,stg-a,2026-11-08T09:00:00Z"].join("\n");
    const { records, rejected } = importCsv(text, { crewId: "stg-a", provenance: "real" });
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ crew_id: "stg-a", metric: "heart_rate", value_num: 72 });
  });

  it("rejects non-numeric cells, bad timestamps and missing timestamps", () => {
    const bad = importCsv("heart_rate,measured_at\nabc,2026-11-08T09:00:00Z", { crewId: "csv-crew", provenance: "real" });
    expect(bad.records).toHaveLength(0);
    expect(bad.rejected).toEqual([{ row: 2, column: "heart_rate", reason: "not a number" }]);
    const badTime = importCsv("heart_rate,measured_at\n72,not-a-date", { crewId: "csv-crew", provenance: "real" });
    expect(badTime.records).toHaveLength(0);
    expect(badTime.rejected).toEqual([{ row: 2, column: "measured_at", reason: "invalid timestamp" }]);
    const missing = importCsv("heart_rate\n72", { crewId: "csv-crew", provenance: "real" });
    expect(missing.records).toHaveLength(0);
    expect(missing.rejected).toEqual([{ row: 2, reason: "missing timestamp" }]);
  });

  it("rejects out-of-bounds values and future timestamps", () => {
    const high = importCsv("heart_rate\n900", { crewId: "csv-crew", provenance: "real", measuredAt: "2026-11-08T10:00:00Z" });
    expect(high.records).toHaveLength(0);
    expect(high.rejected).toEqual([{ row: 2, column: "heart_rate", reason: "out_of_bounds" }]);
    const future = importCsv("heart_rate,measured_at\n72,2030-01-01T00:00:00Z", { crewId: "csv-crew", provenance: "real" });
    expect(future.records).toHaveLength(0);
    expect(future.rejected).toEqual([{ row: 2, column: "heart_rate", reason: "future_timestamp" }]);
  });

  it("rejects a header with no mapped metric columns", () => {
    const { records, rejected } = importCsv("foo,bar\n1,2", { crewId: "csv-crew", provenance: "real" });
    expect(records).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("parses quoted commas", () => {
    expect(parseCsvRows('"a,b",2\n3,4')).toEqual([
      ["a,b", "2"],
      ["3", "4"],
    ]);
  });
});

describe("fhir import", () => {
  const base = { crewId: "fhir-crew", provenance: "real" as const, measuredAt: "2026-11-08T10:00:00Z" };

  it("converts [degF] UCUM units to Celsius and rejects Kelvin and empty units", () => {
    const good = importFhir(
      {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] },
        valueQuantity: { value: 98.6, code: "[degF]" },
        effectiveDateTime: "2026-11-08T10:00:00Z",
      },
      base
    );
    expect(good.rejected).toEqual([]);
    expect(good.records).toHaveLength(1);
    expect(good.records[0].value_num).toBeCloseTo(37, 0);
    expect(good.records[0].unit).toBe("°C");
    const kelvin = importFhir(fhirObs("8310-5", 310, "K"), base);
    expect(kelvin.records).toHaveLength(0);
    expect(kelvin.rejected).toEqual([{ index: 0, reason: "unsupported unit 'K'" }]);
    const missing = importFhir(
      {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] },
        valueQuantity: { value: 98.6 },
        effectiveDateTime: "2026-11-08T10:00:00Z",
      },
      base
    );
    expect(missing.records).toHaveLength(0);
    expect(missing.rejected).toEqual([{ index: 0, reason: "unsupported unit ''" }]);
  });

  it("reads the UCUM code before the display unit", () => {
    const obs = {
      resourceType: "Observation",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] },
      valueQuantity: { value: 98.6, unit: "Cel", code: "[degF]" },
      effectiveDateTime: "2026-11-08T10:00:00Z",
    };
    const { records, rejected } = importFhir(obs, base);
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].value_num).toBeCloseTo(37, 0);
  });

  it("converts mmol/L glucose and rejects g/L", () => {
    const converted = importFhir(fhirObs("2339-0", 5, "mmol/L"), base);
    expect(converted.rejected).toEqual([]);
    expect(converted.records[0].value_num).toBeCloseTo(90, 0);
    expect(converted.records[0].unit).toBe("mg/dL");
    const bad = importFhir(fhirObs("2339-0", 5, "g/L"), base);
    expect(bad.records).toHaveLength(0);
    expect(bad.rejected).toEqual([{ index: 0, reason: "unsupported unit 'g/L'" }]);
  });

  it("rejects out-of-bounds values", () => {
    const { records, rejected } = importFhir(fhirObs("8867-4", 900, "bpm"), base);
    expect(records).toHaveLength(0);
    expect(rejected).toEqual([{ index: 0, reason: "out_of_bounds" }]);
  });

  it("skips non-final observations without a rejection", () => {
    for (const status of ["entered-in-error", "preliminary", "cancelled"]) {
      const { records, rejected } = importFhir(fhirObs("8867-4", 70, "bpm", { status }), base);
      expect(records).toHaveLength(0);
      expect(rejected).toEqual([]);
    }
    const { records } = importFhir(fhirObs("8867-4", 70, "bpm", { status: "amended" }), base);
    expect(records).toHaveLength(1);
  });

  it("rejects future timestamps", () => {
    const { records, rejected } = importFhir(fhirObs("8867-4", 70, "bpm", { effectiveDateTime: "2030-01-01T00:00:00Z" }), base);
    expect(records).toHaveLength(0);
    expect(rejected).toEqual([{ index: 0, reason: "future_timestamp" }]);
  });

  it("imports a BP panel with a shared capture id", () => {
    const panel = {
      resourceType: "Observation",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "85354-9" }] },
      effectiveDateTime: "2026-11-08T10:00:00Z",
      component: [
        {
          code: { coding: [{ system: "http://loinc.org", code: "8480-6" }] },
          valueQuantity: { value: 120, unit: "mmHg" },
        },
        {
          code: { coding: [{ system: "http://loinc.org", code: "8462-4" }] },
          valueQuantity: { value: 80, unit: "mm[Hg]" },
        },
      ],
    };
    const { records, rejected } = importFhir(panel, base);
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(2);
    const sys = records.find((record) => record.metric === "blood_pressure_systolic");
    const dia = records.find((record) => record.metric === "blood_pressure_diastolic");
    expect(sys?.value_num).toBe(120);
    expect(dia?.value_num).toBe(80);
    expect(sys?.capture_id).toBeTruthy();
    expect(sys?.capture_id).toBe(dia?.capture_id);
  });

  it("imports a Bundle and skips unknown codes", () => {
    const { records, rejected } = importFhir(
      {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          { resource: fhirObs("8867-4", 71, "bpm") },
          { resource: fhirObs("2708-6", 98, "%") },
          { resource: fhirObs("9999-9", 1, "x") },
        ],
      },
      base
    );
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ metric: "heart_rate", value_num: 71 });
    expect(records[1]).toMatchObject({ metric: "oxygen_saturation", value_num: 98 });
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/LOINC/);
  });

  it("finds Observations inside plain arrays", () => {
    expect(toObservations([fhirObs("8867-4", 71, "bpm"), "not-an-object", null])).toHaveLength(1);
    expect(toObservations("not-an-object")).toEqual([]);
  });
});

describe("questionnaire", () => {
  it("turns answers into measurements sharing one capture id", () => {
    expect(questionnaireQuestions().map((question) => question.code)).toEqual([
      "sleep_hours",
      "mood_score",
      "stress_score",
      "sleep_quality",
    ]);
    const { records, rejected } = answerQuestionnaire(
      [
        { code: "sleep_hours", value: 7 },
        { code: "mood_score", value: 60 },
      ],
      { crewId: "q-crew", provenance: "real" }
    );
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ crew_id: "q-crew", metric: "sleep_hours", value_num: 7, source: "questionnaire" });
    expect(records[0].capture_id).not.toBeNull();
    expect(records[0].capture_id).toBe(records[1].capture_id);
  });

  it("rejects unknown questions and out-of-range values", () => {
    const { records, rejected } = answerQuestionnaire(
      [
        { code: "nope", value: 1 },
        { code: "sleep_hours", value: 99 },
        { code: "mood_score", value: 50 },
      ],
      { crewId: "q-crew", provenance: "real" }
    );
    expect(records).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });
});

describe("reaction test", () => {
  it("takes the median without the practice tap", () => {
    expect(medianExcludingFirst([500, 300, 200, 400])).toBe(300);
    expect(medianExcludingFirst([100, 300, 200])).toBe(250);
    expect(() => medianExcludingFirst([100])).toThrow();
  });

  it("builds a reaction_time record with a shared capture id", () => {
    const built = reactionToRecord([500, 300, 200, 400], { crewId: "r-crew", provenance: "real" });
    expect("record" in built).toBe(true);
    if ("record" in built) {
      expect(built.record).toMatchObject({ crew_id: "r-crew", metric: "reaction_time", value_num: 300, unit: "ms", source: "test" });
      expect(built.record.capture_id).not.toBeNull();
    }
  });

  it("rejects bad taps", () => {
    expect(reactionToRecord([100], { crewId: "r-crew", provenance: "real" })).toEqual({
      error: "need at least two positive tap times in milliseconds",
    });
    expect(reactionToRecord([100, -5], { crewId: "r-crew", provenance: "real" })).toEqual({
      error: "need at least two positive tap times in milliseconds",
    });
  });
});

describe("body map", () => {
  it("covers every catalog measure exactly once", () => {
    const codes = BODY_SYSTEMS.flatMap((system) => system.measures);
    const catalogCodes = new Set(CATALOG.measures.map((measure) => measure.code));
    for (const code of codes) expect(catalogCodes.has(code), code).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBe(CATALOG.measures.length);
  });

  it("marks systems grey without data", () => {
    const mind = BODY_SYSTEMS.find((system) => system.id === "mind")!;
    expect(systemHasData(mind, new Set())).toBe(false);
    expect(systemHasData(mind, new Set(["heart_rate"]))).toBe(false);
    expect(systemHasData(mind, new Set(["sleep_hours"]))).toBe(true);
  });
});
