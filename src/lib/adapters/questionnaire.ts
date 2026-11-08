import { lookupMeasure, type Measurement, type Phase, type Provenance, type Setting } from "@starplus/core";
import { validateRecord } from "./validate";

export interface QuestionnaireAnswer {
  code: string;
  value: number;
}

export interface QuestionnaireContext {
  crewId: string;
  provenance: Provenance;
  deviceId?: string;
  measuredAt?: string;
  setting?: Setting;
  phase?: Phase;
  phaseDay?: number | null;
}

export interface QuestionnaireResult {
  records: Measurement[];
  rejected: Array<{ code: string; reason: string }>;
}

const QUESTIONS: ReadonlyArray<{ code: string; label: string; min: number; max: number }> = [
  { code: "sleep_hours", label: "Hours slept", min: 0, max: 24 },
  { code: "mood_score", label: "Mood (0–100)", min: 0, max: 100 },
  { code: "stress_score", label: "Stress (0–100)", min: 0, max: 100 },
  { code: "sleep_quality", label: "Sleep quality (0–100)", min: 0, max: 100 },
];

export function questionnaireQuestions(): Array<{ code: string; label: string; min: number; max: number }> {
  return QUESTIONS.map((question) => ({ ...question }));
}

export function answerQuestionnaire(answers: QuestionnaireAnswer[], context: QuestionnaireContext): QuestionnaireResult {
  const records: Measurement[] = [];
  const rejected: Array<{ code: string; reason: string }> = [];
  const captureId = crypto.randomUUID();
  const measuredAt = context.measuredAt ?? new Date().toISOString();
  for (const answer of answers) {
    const question = QUESTIONS.find((item) => item.code === answer.code);
    if (!question) {
      rejected.push({ code: answer.code, reason: "unknown question" });
      continue;
    }
    if (!Number.isFinite(answer.value) || answer.value < question.min || answer.value > question.max) {
      rejected.push({ code: answer.code, reason: `value out of range ${question.min}–${question.max}` });
      continue;
    }
    const measure = lookupMeasure(answer.code);
    if (!measure) {
      rejected.push({ code: answer.code, reason: "unknown metric" });
      continue;
    }
    const record: Measurement = {
      client_id: crypto.randomUUID(),
      crew_id: context.crewId,
      metric: answer.code,
      value_num: answer.value,
      value_text: null,
      unit: measure.unit,
      measured_at: measuredAt,
      received_at: "",
      source: "questionnaire",
      device_id: context.deviceId ?? "questionnaire",
      capture_id: captureId,
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
      rejected.push({ code: answer.code, reason: checked.reason });
      continue;
    }
    records.push(record);
  }
  return { records, rejected };
}
