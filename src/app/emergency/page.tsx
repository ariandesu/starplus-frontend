"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getKbEntry, citeLabel } from "@/lib/kb";
import { deviceDb } from "@/lib/db";
import { enqueueReport } from "@/lib/outbox";
import type { Report } from "@starplus/core";

const SCENARIOS: Array<{ id: string; label: string; entries: string[] }> = [
  { id: "unresponsive", label: "Someone else, not responding", entries: ["firstaid-unresponsive", "firstaid-cpr"] },
  { id: "chest-pain", label: "Me, chest pain", entries: ["firstaid-chest-pain"] },
  { id: "choking", label: "Choking", entries: ["firstaid-choking"] },
  { id: "bleeding", label: "Severe bleeding", entries: ["firstaid-bleeding"] },
  { id: "burns", label: "Burns", entries: ["firstaid-burns"] },
  { id: "anaphylaxis", label: "Allergic reaction", entries: ["firstaid-anaphylaxis"] },
  { id: "low-blood-sugar", label: "Low blood sugar", entries: ["firstaid-low-blood-sugar"] },
  { id: "fainting", label: "Fainting", entries: ["firstaid-fainting"] },
];

interface TakenStep {
  at: string;
  entry: string;
  text: string;
}

export default function EmergencyPage() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [taken, setTaken] = useState<TakenStep[]>([]);
  const [review, setReview] = useState(false);
  const [subject, setSubject] = useState("unknown crewmate");
  const [summary, setSummary] = useState("");
  const [queued, setQueued] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [setting, setSetting] = useState("iss");

  useEffect(() => {
    deviceDb()
      .then((db) => db.get("settings", "setting"))
      .then((row) => {
        if (row) setSetting(row.value);
      })
      .catch(() => undefined);
  }, []);

  const inflight = setting === "iss" || setting === "mars_transit";

  const steps = useMemo(() => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return [];
    return scenario.entries.flatMap((id) => {
      const entry = getKbEntry(id);
      const variant = inflight ? entry?.inflight : undefined;
      const text = variant?.text ?? entry?.text ?? [];
      const citations = variant?.citations ?? entry?.citations ?? [];
      return text.map((line) => ({
        entry: `${entry?.title ?? id}${variant ? " (in flight)" : ""}`,
        source: citations[0] ? citeLabel(citations[0]) : "",
        note: !variant ? entry?.inflight?.note : undefined,
        text: line,
      }));
    });
  }, [scenarioId, inflight]);

  const done = stepIndex >= steps.length;

  function takeStep() {
    const step = steps[stepIndex];
    if (!step) return;
    setTaken((prev) => [...prev, { at: new Date().toISOString(), entry: step.entry, text: step.text }]);
    setStepIndex((i) => i + 1);
  }

  async function queueReport() {
    const report: Report = {
      client_id: crypto.randomUUID(),
      device_id: "device",
      submitted_by: "",
      subject_crew_id: null,
      subject_label: subject || "unknown crewmate",
      kind: "emergency",
      created_at: new Date().toISOString(),
      received_at: "",
      payload_json: JSON.stringify({ scenario: scenarioId, steps: taken }),
      summary_text: summary || null,
      summary_edited: summary ? 1 : 0,
      status: "delivered",
      acknowledged_by: null,
      acknowledged_at: null,
    };
    await enqueueReport(null, report);
    setQueued(true);
  }

  if (discarded) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Report discarded</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent underline">
          Back home
        </Link>
      </div>
    );
  }

  if (queued) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Report queued</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Queued — will send when the link returns. 1 emergency report waiting — log in to send it.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent underline">
          Back home
        </Link>
      </div>
    );
  }

  if (scenarioId === null) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-red-700">Emergency — no login needed, works offline</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who needs help?</p>
        <div className="mt-4 space-y-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => {
                setScenarioId(scenario.id);
                setStepIndex(0);
                setTaken([]);
                setReview(false);
              }}
              className="block w-full rounded-xl border border-border px-4 py-3 text-left text-base font-semibold text-foreground hover:bg-muted"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (review || done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Review the report</h1>
        <ol className="mt-3 space-y-2">
          {taken.map((step, i) => (
            <li key={i} className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
              <span className="font-semibold">{i + 1}. </span>
              {step.text}
              <span className="block text-xs text-muted-foreground">{new Date(step.at).toUTCString()}</span>
            </li>
          ))}
        </ol>
        <label htmlFor="subject" className="mt-4 block text-sm font-semibold text-foreground">
          Subject
        </label>
        <input
          id="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        />
        <label htmlFor="summary" className="mt-3 block text-sm font-semibold text-foreground">
          Summary (optional)
        </label>
        <textarea
          id="summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={queueReport}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
          >
            Queue report
          </button>
          <button
            type="button"
            onClick={() => setDiscarded(true)}
            className="rounded-xl border border-border px-4 py-2 text-sm text-foreground"
          >
            Discard
          </button>
        </div>
        {!done && (
          <button type="button" onClick={() => setReview(false)} className="mt-3 text-sm text-accent underline">
            Back to steps
          </button>
        )}
      </div>
    );
  }

  const step = steps[stepIndex];
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <p className="text-sm text-muted-foreground">
        Step {stepIndex + 1} of {steps.length}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">{step.entry}</h1>
      <p className="mt-3 text-lg leading-relaxed text-foreground">{step.text}</p>
      {step.source && <p className="mt-2 text-xs text-muted-foreground">Source: {step.source}</p>}
      {step.note && <p className="mt-2 text-xs text-muted-foreground">Note: {step.note}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={takeStep}
          className="flex-1 rounded-xl bg-red-700 px-4 py-3 text-base font-bold text-white"
        >
          Done, next step
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex((i) => i - 1)}
            className="text-sm text-accent underline"
          >
            Back
          </button>
        )}
        <button type="button" onClick={() => setReview(true)} className="text-sm text-accent underline">
          Finish and review report
        </button>
      </div>
    </div>
  );
}
