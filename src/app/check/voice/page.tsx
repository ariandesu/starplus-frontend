"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { lookupMeasure, type Measurement, type Phase } from "@starplus/core";
import { extractReadings } from "@/lib/adapters/voice";
import { validateRecord } from "@/lib/adapters/validate";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionInstance {
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const METRIC_OPTIONS = [
  "heart_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "oxygen_saturation",
  "temperature_c",
  "blood_glucose",
  "body_mass",
  "respiratory_rate",
];

const UNSUPPORTED_REASON = "This browser has no speech recognition";

interface EditableReading {
  metric: string;
  value: string;
  unit: string;
}

function VoiceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      (typeof window.SpeechRecognition === "function" || typeof window.webkitSpeechRecognition === "function")
  );
  const [transcript, setTranscript] = useState("");
  const [readings, setReadings] = useState<EditableReading[]>([]);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      setLoggedIn(!!(await getSession(crewId)));
      setReady(true);
    })().catch(() => setReady(true));
  }, [crewId]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId || !loggedIn) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to log a voice reading. <Link href="/login" className="text-accent underline">Go to login</Link>
        </p>
      </div>
    );
  }

  function listen() {
    setNotice(null);
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[event.results.length - 1][0].transcript;
      setTranscript(text);
      setReadings(
        extractReadings(text).map((reading) => ({
          metric: reading.metric ?? "heart_rate",
          value: String(reading.value),
          unit: reading.unit || lookupMeasure(reading.metric ?? "heart_rate")?.unit || "",
        }))
      );
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
      setNotice("Could not hear anything. Try again in a quieter place.");
    };
    setListening(true);
    recognition.start();
  }

  function updateReading(index: number, patch: Partial<EditableReading>) {
    setReadings((prev) => prev.map((reading, i) => (i === index ? { ...reading, ...patch } : reading)));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setBusy(true);
    try {
      const session = await getSession(crewId);
      if (!session) {
        setNotice("Log in first, then save the reading.");
        return;
      }
      if (readings.length === 0) {
        setNotice("Speak a reading first.");
        return;
      }
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "voice";
      const captureId = crypto.randomUUID();
      const measuredAt = new Date().toISOString();
      const records: Measurement[] = [];
      for (const reading of readings) {
        const measure = lookupMeasure(reading.metric);
        const record: Measurement = {
          client_id: crypto.randomUUID(),
          crew_id: crewId,
          metric: reading.metric,
          value_num: Number(reading.value),
          value_text: null,
          unit: reading.unit || measure?.unit || "",
          measured_at: measuredAt,
          received_at: "",
          source: "voice",
          device_id: deviceId,
          capture_id: captureId,
          is_estimate: 0,
          confirmed_by_user: 0,
          provenance: (session.provenance ?? "real") as Measurement["provenance"],
          setting: "iss",
          phase: "inflight" as Phase,
          phase_day: null,
          supersedes_client_id: null,
          voided: 0,
          catalog_version: "1",
          schema_version: 1,
        };
        const checked = validateRecord(record);
        if (!checked.ok) {
          setNotice(`${reading.metric}: ${checked.reason}`);
          return;
        }
        records.push(record);
      }
      const resultId = await assessAndQueue(crewId, "inflight", records);
      router.push(`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(resultId)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Voice check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Say a reading out loud. Transcripts stay on this device.
      </p>
      {!supported ? (
        <p className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground" data-testid="voice-unsupported">
          {UNSUPPORTED_REASON} (speech recognition needs a network on most browsers).
        </p>
      ) : (
        <button
          type="button"
          data-testid="mic"
          onClick={listen}
          disabled={listening}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {listening ? "Listening…" : transcript ? "Speak again" : "Speak a reading"}
        </button>
      )}
      {transcript ? <p className="mt-3 text-sm text-foreground">Heard: “{transcript}”</p> : null}
      {readings.length > 0 ? (
        <form
          onSubmit={(event) => {
            void save(event);
          }}
          className="mt-4 space-y-3"
        >
          <h2 className="text-base font-semibold text-foreground">Preview</h2>
          {readings.map((reading, index) => (
            <div key={index} className="grid grid-cols-3 gap-2">
              <select
                aria-label="Metric"
                value={reading.metric}
                onChange={(event) => {
                  const metric = event.target.value;
                  updateReading(index, { metric, unit: lookupMeasure(metric)?.unit ?? reading.unit });
                }}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
              >
                {METRIC_OPTIONS.map((metric) => (
                  <option key={metric} value={metric}>
                    {metric}
                  </option>
                ))}
              </select>
              <input
                aria-label="Value"
                inputMode="decimal"
                value={reading.value}
                onChange={(event) => updateReading(index, { value: event.target.value })}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
              />
              <input
                aria-label="Unit"
                value={reading.unit}
                onChange={(event) => updateReading(index, { unit: event.target.value })}
                className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
              />
            </div>
          ))}
          <button
            type="submit"
            data-testid="save"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save result
          </button>
        </form>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-red-700">{notice}</p> : null}
    </div>
  );
}

export default function VoicePage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <VoiceForm />
    </Suspense>
  );
}
