import { describe, expect, it } from "vitest";
import { CATALOG } from "@starplus/core";
import { BODY_SYSTEMS, systemHasData } from "../src/components/body-map";
import { importCsv } from "../src/lib/adapters/import-csv";
import { importFhir } from "../src/lib/adapters/import-fhir";
import { answerQuestionnaire, questionnaireQuestions } from "../src/lib/adapters/questionnaire";
import { medianExcludingFirst, reactionToRecord } from "../src/lib/adapters/reaction-test";

const SYNTHETIC_SAMPLE = [
  "record_id,astronaut_id,data_source,agency,mission_phase,systolic_bp_mmHg,diastolic_bp_mmHg,mean_arterial_pressure_mmHg,blood_glucose_mg_dL,core_body_temp_C,heart_rate_bpm,hrv_rmssd_ms,spo2_percent,respiratory_rate_bpm,sleep_duration_h,sleep_quality_score_0_100,mood_score_0_100,physical_activity_min_per_day,body_mass_kg,body_weight_lb,hydration_urine_specific_gravity,stress_score_0_100,sick/fit",
  "SYN-00001,SYN-A001,SYNTHETIC,NASA,preflight_L-90,138,72,94.0,92.2,37.07,65.9,44.8,97.5,11.6,6.25,56.2,60.3,43.2,78.57,173.22,1.0131,39.6,0",
  "SYN-00002,SYN-A001,SYNTHETIC,NASA,preflight_L-10,126,72,90.0,88.8,37.11,62.0,50.5,96.9,9.4,5.47,62.6,54.3,56.9,79.06,174.29,1.012,49.5,0",
].join("\n");

const FHIR_BUNDLE = {
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
        valueQuantity: { value: 71, unit: "bpm" },
        effectiveDateTime: "2026-11-08T08:00:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "2708-6", display: "Oxygen saturation" }] },
        valueQuantity: { value: 98, unit: "%" },
        effectiveDateTime: "2026-11-08T08:01:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "9999-9", display: "Unknown thing" }] },
        valueQuantity: { value: 1, unit: "x" },
        effectiveDateTime: "2026-11-08T08:02:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "preliminary",
        code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] },
        effectiveDateTime: "not-a-date",
      },
    },
  ],
};

describe("csv import", () => {
  it("imports the synthetic CSV columns into catalog measures", () => {
    const { records, rejected } = importCsv(SYNTHETIC_SAMPLE, {
      crewId: "csv-crew",
      measuredAt: "2026-11-08T10:00:00Z",
    });
    expect(rejected).toEqual([]);
    // 15 mapped columns per row, 2 rows.
    expect(records).toHaveLength(30);
    const heart = records.find((record) => record.metric === "heart_rate" && record.value_num === 65.9);
    expect(heart).toMatchObject({ crew_id: "csv-crew", unit: "bpm", source: "import", measured_at: "2026-11-08T10:00:00Z" });
    const systolic = records.find((record) => record.metric === "blood_pressure_systolic");
    const diastolic = records.find((record) => record.metric === "blood_pressure_diastolic");
    expect(systolic).toBeDefined();
    expect(diastolic).toBeDefined();
    expect(systolic!.capture_id).not.toBeNull();
    expect(systolic!.capture_id).toBe(diastolic!.capture_id);
    expect(records.filter((record) => !record.metric.startsWith("blood_pressure")).every((record) => record.capture_id === null)).toBe(true);
  });

  it("maps catalog-code headers and per-row crew and timestamps", () => {
    const text = ["metric,crew_id,heart_rate,spo2_nope,measured_at", "x,stg-a,72,,2026-11-08T09:00:00Z"].join("\n");
    const { records, rejected } = importCsv(text, { crewId: "fallback-crew" });
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ crew_id: "stg-a", metric: "heart_rate", value_num: 72 });
  });

  it("rejects non-numeric cells and bad timestamps", () => {
    const text = ["heart_rate,measured_at", "abc,2026-11-08T09:00:00Z", "72,not-a-date"].join("\n");
    const { records, rejected } = importCsv(text, { crewId: "csv-crew" });
    expect(records).toHaveLength(0);
    expect(rejected).toEqual([
      { row: 2, column: "heart_rate", reason: "not a number" },
      { row: 3, column: "measured_at", reason: "invalid timestamp" },
    ]);
  });

  it("rejects files without mapped columns", () => {
    const { records, rejected } = importCsv("foo,bar\n1,2", { crewId: "csv-crew" });
    expect(records).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });
});

describe("fhir import", () => {
  it("imports Observations from a Bundle and skips the bad ones", () => {
    const { records, rejected } = importFhir(FHIR_BUNDLE, { crewId: "fhir-crew" });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ crew_id: "fhir-crew", metric: "heart_rate", value_num: 71, unit: "bpm", source: "import" });
    expect(records[1]).toMatchObject({ metric: "oxygen_saturation", value_num: 98, unit: "%" });
    expect(rejected).toHaveLength(2);
    expect(rejected[0].reason).toMatch(/LOINC/);
    expect(rejected[1].reason).toMatch(/valueQuantity/);
  });

  it("converts Fahrenheit to Celsius", () => {
    const { records, rejected } = importFhir(
      {
        resourceType: "Observation",
        status: "final",
        code: { coding: [{ system: "http://loinc.org", code: "8310-5" }] },
        valueQuantity: { value: 98.6, unit: "degF" },
      },
      { crewId: "fhir-crew", measuredAt: "2026-11-08T10:00:00Z" }
    );
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0].metric).toBe("temperature_c");
    expect(records[0].value_num).toBeCloseTo(37, 0);
    expect(records[0].unit).toBe("°C");
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
      { crewId: "q-crew" }
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
      { crewId: "q-crew" }
    );
    expect(records).toHaveLength(1);
    expect(rejected).toHaveLength(2);
  });
});

describe("reaction test", () => {
  it("takes the median without the practice tap", () => {
    expect(medianExcludingFirst([500, 300, 200, 400])).toBe(300);
    expect(medianExcludingFirst([100, 300, 200])).toBe(250);
  });

  it("rejects too few or invalid taps", () => {
    expect(() => medianExcludingFirst([100])).toThrow();
    expect(reactionToRecord([100], { crewId: "r-crew" })).toEqual({
      error: "need at least two positive tap times in milliseconds",
    });
    expect(reactionToRecord([100, -5], { crewId: "r-crew" })).toEqual({
      error: "need at least two positive tap times in milliseconds",
    });
  });

  it("builds a reaction_time record", () => {
    const built = reactionToRecord([500, 300, 200, 400], { crewId: "r-crew" });
    expect("record" in built).toBe(true);
    if ("record" in built) {
      expect(built.record).toMatchObject({ crew_id: "r-crew", metric: "reaction_time", value_num: 300, unit: "ms", source: "test" });
    }
  });
});

describe("body map systems", () => {
  it("covers every catalog measure exactly once", () => {
    const codes = BODY_SYSTEMS.flatMap((system) => system.measures);
    const catalogCodes = new Set(CATALOG.measures.map((measure) => measure.code));
    for (const code of codes) {
      expect(catalogCodes.has(code), code).toBe(true);
    }
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
