"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import type { Phase } from "@starplus/core";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { answerQuestionnaire, questionnaireQuestions } from "@/lib/adapters/questionnaire";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

function QuestionnaireForm() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!crewId) return;
    setNotice(null);
    setBusy(true);
    try {
      const session = await getSession(crewId);
      if (!session) {
        setNotice("Log in first, then answer the questionnaire.");
        return;
      }
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "questionnaire";
      const questions = questionnaireQuestions();
      const unanswered = questions.filter((question) => (answers[question.code] ?? "").trim() === "");
      if (unanswered.length > 0) {
        setNotice("Answer every question.");
        return;
      }
      const { records, rejected } = answerQuestionnaire(
        questions.map((question) => ({ code: question.code, value: Number(answers[question.code]) })),
        {
          crewId,
          provenance: (session.provenance ?? "real") as "real" | "synthetic" | "simulated_device",
          deviceId,
          setting: "iss",
          phase: "inflight" as Phase,
          phaseDay: null,
        }
      );
      if (rejected.length > 0) {
        setNotice(rejected.map((item) => `${item.code}: ${item.reason}`).join("; "));
        return;
      }
      if (records.length === 0) {
        setNotice("Answer every question.");
        return;
      }
      const resultId = await assessAndQueue(crewId, "inflight", records);
      router.push(`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(resultId)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 my-6 w-auto max-w-2xl rounded-card border border-border bg-card p-5 shadow-card sm:mx-auto lg:p-6">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Daily questionnaire</h1>
      <p className="mt-1 text-sm text-muted-foreground">A few quick questions. Your answers stay on this device until a link returns.</p>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="mt-4 space-y-3"
      >
        {questionnaireQuestions().map((question) => (
          <div key={question.code} className="rounded-xl border border-border p-4">
            <label htmlFor={`q-${question.code}`} className="text-sm font-semibold text-foreground">
              {question.label}
            </label>
            <input
              id={`q-${question.code}`}
              inputMode="numeric"
              autoComplete="off"
              value={answers[question.code] ?? ""}
              onChange={(event) => setAnswers((prev) => ({ ...prev, [question.code]: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save answers"}
        </button>
      </form>
      {notice && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}

export default function QuestionnairePage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <QuestionnaireForm />
    </Suspense>
  );
}
