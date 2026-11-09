"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { lookupMeasure, type Measurement, type Phase } from "@starplus/core";
import { parseDisplayReading, recognizeDisplay } from "@/lib/adapters/ocr";
import { previewFromReadings, type EditableReading } from "@/lib/adapters/voice";
import { validateRecord } from "@/lib/adapters/validate";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { ReadingPreview } from "@/components/reading-preview";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { ContinueAsButtons } from "@/components/continue-as";

function CameraForm() {
  const router = useRouter();
  const { crewId, ready: crewReady, candidates } = useActiveCrew();
  const [photoText, setPhotoText] = useState("");
  const [typedText, setTypedText] = useState("");
  const [readings, setReadings] = useState<EditableReading[]>([]);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to read a device display. <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=astronaut" className="text-accent underline">Try the demo</Link>
        </p>
          <ContinueAsButtons candidates={candidates} />
      </div>
    );
  }

  function showReadings(text: string) {
    setReadings(previewFromReadings(parseDisplayReading(text)));
  }

  async function readPhoto(file: File) {
    setNotice(null);
    setReading(true);
    try {
      const text = await recognizeDisplay(file);
      setPhotoText(text);
      showReadings(text);
    } catch {
      setNotice("Display reading needs a link the first time (to download the reader).");
    } finally {
      setReading(false);
    }
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
        setNotice("Photograph a display or type what it shows first.");
        return;
      }
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "camera";
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
          source: "ocr",
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
      <h1 className="text-2xl font-bold text-foreground">Camera check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Photograph a device display to read its numbers. The reader downloads on first use, so it
        needs a link the first time.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-semibold text-foreground" htmlFor="camera-photo">
          Photograph the display
          <input
            id="camera-photo"
            data-testid="photo"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={reading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readPhoto(file);
            }}
            className="mt-1 block w-full text-sm text-foreground"
          />
        </label>
        <label className="block text-sm font-semibold text-foreground" htmlFor="camera-text">
          Or type what the display shows
          <input
            id="camera-text"
            data-testid="display-text"
            value={typedText}
            onChange={(event) => {
              setTypedText(event.target.value);
              showReadings(event.target.value);
            }}
            placeholder="e.g. 120/80 mmHg"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
      </div>
      {reading ? <p className="mt-3 text-sm text-muted-foreground">Reading the display…</p> : null}
      {photoText ? <p className="mt-3 text-sm text-foreground">Read: “{photoText.trim()}”</p> : null}
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

export default function CameraPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <CameraForm />
    </Suspense>
  );
}
