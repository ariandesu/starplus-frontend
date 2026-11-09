"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { lookupMeasure, type Measurement, type Phase } from "@starplus/core";
import { transcriptToPreview, type EditableReading } from "@/lib/adapters/voice";
import { validateRecord } from "@/lib/adapters/validate";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { ReadingPreview } from "@/components/reading-preview";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { ContinueAsButtons } from "@/components/continue-as";

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

const UNSUPPORTED_REASON = "This browser has no speech recognition";

function VoiceForm() {
  const router = useRouter();
  const { crewId, ready: crewReady, candidates } = useActiveCrew();
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

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to log a voice reading. <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=astronaut" className="text-accent underline">Try the demo</Link>
        </p>
          <ContinueAsButtons candidates={candidates} />
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
      setReadings(transcriptToPreview(text));
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
    const id = crewId;
    if (!id) return;
    setNotice(null);
    setBusy(true);
    try {
      const session = await getSession(id);
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
          crew_id: id,
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
      const resultId = await assessAndQueue(id, "inflight", records);
      router.push(`/result?crew=${encodeURIComponent(id)}&result=${encodeURIComponent(resultId)}`);
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
        <ReadingPreview
          readings={readings}
          onChange={updateReading}
          onSave={(event) => {
            void save(event);
          }}
          busy={busy}
        />
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
