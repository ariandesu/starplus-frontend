"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getKbEntry, citeLabel } from "@/lib/kb";
import { attachmentId, base64Bytes, blobToBase64, compressImage, type PendingAttachment } from "@/lib/adapters/attachment";
import { deviceDb } from "@/lib/db";
import { enqueueReport, pendingEmergencyCount } from "@/lib/outbox";
import { onSynced } from "@/lib/outbox-sync";
import { hasActiveSession } from "@/lib/session";
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
  const [photo, setPhoto] = useState<PendingAttachment | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [setting, setSetting] = useState("iss");

  useEffect(() => {
    let cancelled = false;
    const refreshWaiting = async () => {
      const [count, session] = await Promise.all([pendingEmergencyCount(), hasActiveSession()]);
      if (!cancelled) {
        setWaiting(count > 0);
        setHasSession(session);
      }
    };
    void refreshWaiting().catch(() => undefined);
    const offSynced = onSynced(() => {
      void refreshWaiting().catch(() => undefined);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshWaiting().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      offSynced();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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
    const attachments = photo ? [photo] : [];
    const report: Report = {
      client_id: crypto.randomUUID(),
      device_id: "device",
      submitted_by: "",
      subject_crew_id: null,
      subject_label: subject || "unknown crewmate",
      kind: "emergency",
      created_at: new Date().toISOString(),
      received_at: "",
      payload_json: JSON.stringify({ scenario: scenarioId, steps: taken, attachments }),
      summary_text: summary || null,
      summary_edited: summary ? 1 : 0,
      status: "delivered",
      acknowledged_by: null,
      acknowledged_at: null,
    };
    await enqueueReport(null, report);
    setWaiting(true);
    setQueued(true);
  }

  async function attachPhoto(file: File) {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      const dataBase64 = await blobToBase64(compressed);
      const size = base64Bytes(dataBase64);
      if (size > 2 * 1024 * 1024) {
        setPhotoError("The photo is too large even after compression.");
        return;
      }
      setPhoto({ id: attachmentId(), content_type: "image/jpeg", size, data_base64: dataBase64 });
    } catch {
      setPhotoError("Could not read that photo. Try another one.");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (discarded) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-[1.75rem] font-bold tracking-tight">Report discarded</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent-strong underline">
          Back home
        </Link>
      </div>
    );
  }

  if (queued) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-[1.75rem] font-bold tracking-tight">{waiting ? "Report queued" : "Report sent"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {waiting
            ? hasSession
              ? "Queued — will send when the link returns. 1 emergency report waiting — sending when the link is up."
              : "Queued — will send when the link returns. 1 emergency report waiting — log in to send it."
            : "Sent to the flight surgeon."}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent-strong underline">
          Back home
        </Link>
      </div>
    );
  }

  if (scenarioId === null) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-[1.75rem] font-bold tracking-tight text-danger">Emergency — no login needed, works offline</h1>
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
              className="block min-h-11 w-full rounded-tile border border-border bg-card px-4 py-3 text-left text-base font-semibold text-foreground shadow-card hover:bg-surface-2"
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
        <h1 className="text-[1.75rem] font-bold tracking-tight">Review the report</h1>
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
        <label htmlFor="photo" className="mt-3 block text-sm font-semibold text-foreground">
          Photo (optional)
        </label>
        <input
          id="photo"
          data-testid="photo"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={photoBusy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void attachPhoto(file);
          }}
          className="mt-1 block w-full text-sm text-foreground"
        />
        {photoBusy ? <p className="mt-1 text-xs text-muted-foreground">Compressing the photo…</p> : null}
        {photo ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="photo-ready">
            Photo attached ({Math.round(photo.size / 1024)} KB). It uploads when the report sends.
          </p>
        ) : null}
        {photoError ? <p className="mt-1 text-sm text-danger">{photoError}</p> : null}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={queueReport}
            className="min-h-13 rounded-full bg-danger-fill px-4 py-2 text-sm font-bold text-danger-foreground"
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
          <button type="button" onClick={() => setReview(false)} className="mt-3 text-sm text-accent-strong underline">
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
          className="min-h-13 flex-1 rounded-full bg-danger-fill px-4 py-3 text-base font-bold text-danger-foreground"
        >
          Done, next step
        </button>
      </div>
      <div className="mt-3 flex gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => setStepIndex((i) => i - 1)}
            className="text-sm text-accent-strong underline"
          >
            Back
          </button>
        )}
        <button type="button" onClick={() => setReview(true)} className="text-sm text-accent-strong underline">
          Finish and review report
        </button>
      </div>
    </div>
  );
}
