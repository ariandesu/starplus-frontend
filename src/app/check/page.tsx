"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  Bluetooth,
  Camera,
  ClipboardList,
  HeartPulse,
  Mic,
  Timer,
  Upload,
  type LucideIcon,
} from "lucide-react";
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
import { PageHeader } from "@/components/dashboard/page-header";
import { MeasureForm } from "@/components/measure-form";
import { MissionCard } from "@/components/mission-card";
import { Card } from "@/components/ui/card";
import { RequireSession } from "@/components/require-session";
import { deviceDb, profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";
import { getModelDefinition, getKbEntry, citeLabel } from "@/lib/kb";
import { enqueueMeasurement, enqueueResult } from "@/lib/outbox";
import { getSession } from "@/lib/session";
import { computeXp } from "@/lib/xp";

async function getSetting(key: string, fallback: string): Promise<string> {
  const db = await deviceDb();
  const row = await db.get("settings", key);
  return row?.value ?? fallback;
}

interface Method {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const METHODS: Method[] = [
  { href: "/check/bluetooth", label: "Connect a Bluetooth device", description: "Pair a device and stream readings.", icon: Bluetooth },
  { href: "/check/camera", label: "Read a device display", description: "Read a device display with the camera.", icon: Camera },
  { href: "/check/camera-hr", label: "Measure heart rate with the camera", description: "Estimate heart rate from a fingertip on the camera.", icon: HeartPulse },
  { href: "/check/voice", label: "Speak a reading", description: "Say the value out loud and save it.", icon: Mic },
  { href: "/check/reaction", label: "Take the reaction test", description: "Tap when the screen changes.", icon: Timer },
  { href: "/check/questionnaire", label: "Answer a short questionnaire", description: "Answer a few short questions.", icon: ClipboardList },
  { href: "/import", label: "Import a CSV or FHIR file", description: "Bring readings in from a file.", icon: Upload },
];

function CheckForm() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
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
      const pastResults = await db.getAll("results");
      const latestForXp = [...pastResults].sort(
        (a, b) => Date.parse(a.assessed_at) - Date.parse(b.assessed_at)
      ).pop() ?? null;
      const xpOpts = {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        demo: Boolean(session?.demo),
        deviceId: device_id,
        now: Date.now(),
      };
      const xpBefore = computeXp(history, latestForXp, xpOpts);
      const xpAfter = computeXp([...history, ...records], latestForXp, xpOpts);
      const gained = xpAfter.total - xpBefore.total;
      const full = xpAfter.fullCheckToday && !xpBefore.fullCheckToday;
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
      router.push(
        `/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(result.client_id)}${
          gained > 0 ? `&xp=${gained}&fullcheck=${full ? 1 : 0}` : ""
        }`
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader eyebrow="SELF-CHECK" title="Self-check" />
      <p className="mt-1 text-sm text-muted">
        {SETTING_LABELS[setting] ?? setting} · {PHASE_LABELS[phase] ?? phase}. Complete this in under a minute.
      </p>

      <MissionCard crewId={crewId} />

      <Card className="mt-4 p-5 lg:p-6">
        <label htmlFor="measure-select" className="block text-sm font-semibold text-foreground">
          What are you measuring?
        </label>
        <select
          id="measure-select"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-1 h-11 w-full rounded-control border border-input bg-surface px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          <div className="mt-4 rounded-tile border border-border bg-surface p-4">
            <label htmlFor="dia-value" className="text-sm font-semibold text-foreground">
              Diastolic (mmHg) — same cuff, same moment
            </label>
            <input
              id="dia-value"
              inputMode="decimal"
              autoComplete="off"
              value={diaValue}
              onChange={(event) => setDiaValue(event.target.value)}
              className="mt-1 h-11 w-full rounded-control border border-input bg-card px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
        )}
        {notice && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {notice}
          </p>
        )}
        {busy && <p className="mt-3 text-sm text-muted">Scoring…</p>}
      </Card>

      <section aria-label="Other ways" className="mt-6">
        <h2 className="text-lg font-semibold text-foreground">Other ways</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {METHODS.map((method) => {
            const Icon = method.icon;
            const href = crewId ? `${method.href}?crew=${encodeURIComponent(crewId)}` : method.href;
            return (
              <Link
                key={method.href}
                href={href}
                className="flex min-h-11 items-start gap-3 rounded-tile border border-border bg-card p-4 shadow-card transition-colors hover:bg-surface-2 focus-ring"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-foreground">{method.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{method.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const SETTING_LABELS: Record<string, string> = {
  iss: "ISS",
  mars_transit: "Mars transit",
  moon_base: "Moon base",
  rover: "Surface rover",
};

const PHASE_LABELS: Record<string, string> = {
  preflight: "Pre-flight",
  inflight: "In flight",
  surface: "Surface",
  postflight: "Post-flight",
};

export default function CheckPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <CheckForm />
    </Suspense>
  );
}
