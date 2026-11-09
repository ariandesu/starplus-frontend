"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  CATALOG,
  assess,
  loadModel,
  lookupMeasure,
  normalise,
  predict,
  sdFloorFor,
  validateRecord,
  type AssessContext,
  type Measurement,
  type Phase,
  type Setting,
} from "@starplus/core";
import { MeasureForm } from "@/components/measure-form";
import { deviceDb, profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";
import { getModelDefinition, getKbEntry, citeLabel } from "@/lib/kb";
import { enqueueMeasurement, enqueueResult } from "@/lib/outbox";
import { getSession } from "@/lib/session";
import { ContinueAsButtons } from "@/components/continue-as";

async function getSetting(key: string, fallback: string): Promise<string> {
  const db = await deviceDb();
  const row = await db.get("settings", key);
  return row?.value ?? fallback;
}

function CheckForm() {
  const router = useRouter();
  const { crewId, ready: crewReady, candidates } = useActiveCrew();
  const [ready, setReady] = useState(false);
  const [setting, setSetting] = useState<Setting>("iss");
  const [phase, setPhase] = useState<Phase>("inflight");
  const [code, setCode] = useState(CATALOG.measures[0].code);
  const [diaValue, setDiaValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const measure = useMemo(() => CATALOG.measures.find((m) => m.code === code)!, [code]);
  const kb = useMemo(() => (measure ? getKbEntry(measure.guidance_key) : null), [measure]);
  const needsPair = code === "blood_pressure_systolic";

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      setSetting((await getSetting("setting", "iss")) as Setting);
      setPhase((await getSetting("phase", "inflight")) as Phase);
      setReady(true);
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  async function submit(draft: {
    metric: string;
    value: number;
    unit: string;
    source: "manual";
    confidence: number;
    howto: string;
    why: string;
  }) {
    if (!crewId) return;
    setBusy(true);
    setNotice(null);
    try {
      const device_id = (await (await deviceDb()).get("settings", "device_id"))?.value ?? "unknown-device";
      const session = await getSession(crewId);
      const base = {
        crew_id: crewId,
        device_id,
        setting,
        phase,
        provenance: (session?.provenance ?? "real") as "real" | "synthetic" | "simulated_device",
        confirmed_by_user: false,
      };
      const capture_id = needsPair ? crypto.randomUUID() : undefined;
      const drafts = [{ ...draft, capture_id }];
      if (needsPair) {
        const dia = Number(diaValue);
        if (!Number.isFinite(dia)) {
          setNotice("Enter the diastolic value as well; blood pressure goes together.");
          setBusy(false);
          return;
        }
        drafts.push({ metric: "blood_pressure_diastolic", value: dia, unit: "mmHg", source: "manual" as const, confidence: draft.confidence, capture_id, howto: "", why: "" });
      }
      const records: Measurement[] = [];
      for (const item of drafts) {
        const normalised = normalise(item, base);
        if (!normalised.ok) {
          setNotice(normalised.reasons.join(" "));
          setBusy(false);
          return;
        }
        const checked = validateRecord(normalised.value);
        if (!checked.ok) {
          setNotice(checked.reasons.join(" "));
          setBusy(false);
          return;
        }
        records.push(checked.value);
      }
      const db = await profileDb(crewId);
      const history = await db.getAll("measurements");
      const modelInput = (() => {
        try {
          const loaded = loadModel(getModelDefinition());
          if (!loaded.ok) return null;
          const features: Record<string, number> = {};
          for (const input of loaded.model.definition.inputs) {
            const measure = lookupMeasure(input.metric);
            const earlier = history
              .filter((r) => r.metric === input.metric && r.value_num !== null)
              .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));
            const latest =
              [...earlier, ...records.filter((r) => r.metric === input.metric && r.value_num !== null)].sort(
                (a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at)
              ).pop() ?? null;
            const values = earlier.map((r) => r.value_num as number);
            const mean = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
            const spread =
              values.length > 1
                ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
                : 0;
            const floor = measure ? sdFloorFor(measure, mean) : 1;
            const latestValue = (latest?.value_num as number | null) ?? 0;
            features[`${input.metric}:${input.feature}`] =
              input.feature === "latest" ? latestValue : (latestValue - mean) / Math.max(spread, floor);
          }
          const probability = predict(loaded.model.definition, features);
          return {
            probability,
            model_version: loaded.model.definition.model_version,
            model_id: loaded.model.definition.model_id,
            threshold_watch: loaded.model.threshold_watch,
          };
        } catch {
          return null;
        }
      })();
      const context: AssessContext = { now: Date.now(), phase, model: modelInput };
      const result = await assess([...history, ...records], context);
      for (const record of records) await enqueueMeasurement(crewId, record);
      await enqueueResult(crewId, result);
      router.push(`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(result.client_id)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">Self-check</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in first — your readings belong to your profile.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/login" className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Go to login
          </Link>
          <Link href="/login?demo=astronaut" className="inline-block rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground">
            Try the demo
          </Link>
        </div>
        <ContinueAsButtons candidates={candidates} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Self-check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Setting {setting}, phase {phase}. Complete this in under a minute.
      </p>
      <label htmlFor="measure-select" className="mt-4 block text-sm font-semibold text-foreground">
        What are you measuring?
      </label>
      <select
        id="measure-select"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
      >
        {CATALOG.measures.map((m) => (
          <option key={m.code} value={m.code}>
            {m.label} ({m.unit || "score"})
          </option>
        ))}
      </select>
      <div className="mt-4">
        <MeasureForm
          measure={measure}
          howto={kb?.text[0] ?? ""}
          why={kb?.text[1] ?? (kb?.citations[0] ? citeLabel(kb.citations[0]) : "")}
          onSubmit={submit}
        />
      </div>
      {needsPair && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <label htmlFor="dia-value" className="text-sm font-semibold text-foreground">
            Diastolic (mmHg) — same cuff, same moment
          </label>
          <input
            id="dia-value"
            inputMode="decimal"
            autoComplete="off"
            value={diaValue}
            onChange={(event) => setDiaValue(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </div>
      )}
      {notice && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {notice}
        </p>
      )}
      {busy && <p className="mt-3 text-sm text-muted-foreground">Scoring…</p>}
      <div className="mt-8 border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">Other ways</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/questionnaire?crew=${encodeURIComponent(crewId)}` : "/check/questionnaire"}>
              Answer a short questionnaire
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/reaction?crew=${encodeURIComponent(crewId)}` : "/check/reaction"}>
              Take the reaction test
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/import?crew=${encodeURIComponent(crewId)}` : "/import"}>
              Import a CSV or FHIR file
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/bluetooth?crew=${encodeURIComponent(crewId)}` : "/check/bluetooth"}>
              Connect a Bluetooth device
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/voice?crew=${encodeURIComponent(crewId)}` : "/check/voice"}>
              Speak a reading
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/camera?crew=${encodeURIComponent(crewId)}` : "/check/camera"}>
              Read a device display
            </Link>
          </li>
          <li>
            <Link className="text-accent underline" href={crewId ? `/check/camera-hr?crew=${encodeURIComponent(crewId)}` : "/check/camera-hr"}>
              Measure heart rate with the camera
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function CheckPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <CheckForm />
    </Suspense>
  );
}
