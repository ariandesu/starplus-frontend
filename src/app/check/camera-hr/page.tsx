"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Measurement, Phase } from "@starplus/core";
import {
  estimateHeartRate,
  startCameraReader,
  type CameraReader,
  type HrSample,
} from "@/lib/adapters/camera-hr";
import { validateRecord } from "@/lib/adapters/validate";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

const UNSUPPORTED_REASON = "This browser has no camera support";

function CameraHrForm() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [supported] = useState(
    () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
  );
  const [samples, setSamples] = useState<HrSample[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<CameraReader | null>(null);

  useEffect(() => {
    return () => {
      readerRef.current?.stop();
    };
  }, []);

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  function ingest(next: HrSample[]) {
    setSamples(next);
    setBpm(estimateHeartRate(next));
  }

  async function start() {
    setNotice(null);
    setBusy(true);
    try {
      if (!videoRef.current) return;
      setSimulated(false);
      setSamples([]);
      setBpm(null);
      const reader = await startCameraReader(videoRef.current, () => {
        ingest([...reader.samples]);
      });
      readerRef.current = reader;
      setMeasuring(true);
    } catch {
      setNotice(UNSUPPORTED_REASON);
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    readerRef.current?.stop();
    readerRef.current = null;
    setMeasuring(false);
  }

  function simulate() {
    setNotice(null);
    stop();
    setSimulated(true);
    const frames: HrSample[] = [];
    for (let t = 0; t < 100; t++) {
      frames.push({ at: t * 100, red: 128 + 20 * Math.sin((2 * Math.PI * 72 * t) / 600) });
    }
    ingest(frames);
  }

  async function save() {
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
      if (bpm === null) {
        setNotice("Measure first, then save the estimate.");
        return;
      }
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "camera-hr";
      const record: Measurement = {
        client_id: crypto.randomUUID(),
        crew_id: id,
        metric: "heart_rate",
        value_num: bpm,
        value_text: null,
        unit: "bpm",
        measured_at: new Date().toISOString(),
        received_at: "",
        source: "camera_hr",
        device_id: deviceId,
        capture_id: crypto.randomUUID(),
        is_estimate: 1,
        confirmed_by_user: 0,
        provenance: (simulated ? "simulated_device" : (session.provenance ?? "real")) as Measurement["provenance"],
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
        setNotice(`heart_rate: ${checked.reason}`);
        return;
      }
      const resultId = await assessAndQueue(id, "inflight", [record]);
      router.push(`/result?crew=${encodeURIComponent(id)}&result=${encodeURIComponent(resultId)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 my-6 w-auto max-w-2xl rounded-card border border-border bg-card p-5 shadow-card sm:mx-auto lg:p-6">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Camera heart rate</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cover the camera with your fingertip. This is always an estimate — it is never used for
        baselines.
      </p>
      {!supported ? (
        <p className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground" data-testid="camera-unsupported">
          {UNSUPPORTED_REASON}
        </p>
      ) : null}
      <video ref={videoRef} playsInline muted className="mt-4 w-full rounded-xl bg-black" data-testid="preview" />
      <div className="mt-4 flex gap-2">
        {measuring ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            data-testid="measure"
            onClick={() => void start()}
            disabled={busy || !supported}
            title={supported ? undefined : UNSUPPORTED_REASON}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Measure
          </button>
        )}
        <button
          type="button"
          data-testid="simulator"
          onClick={simulate}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Simulate a signal
        </button>
      </div>
      <p className="mt-3 text-sm text-foreground" data-testid="estimate">
        {samples.length === 0
          ? "No signal yet."
          : bpm === null
            ? `Sampling… ${Math.round(samples[samples.length - 1].at - samples[0].at) / 1000}s so far.`
            : `Estimated heart rate: ${bpm} bpm (estimate).`}
      </p>
      {bpm !== null ? (
        <button
          type="button"
          data-testid="save"
          onClick={() => void save()}
          disabled={busy}
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Save estimate
        </button>
      ) : null}
      {notice ? <p className="mt-3 text-sm text-danger">{notice}</p> : null}
    </div>
  );
}

export default function CameraHrPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <CameraHrForm />
    </Suspense>
  );
}
