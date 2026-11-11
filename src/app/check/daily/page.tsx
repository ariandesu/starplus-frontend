"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import {
  MISSION_PATCHES,
  lookupMeasure,
  normalise,
  patchesForStreak,
  scoreDays,
  streakDays,
  todayLocal,
  validateRecord,
  type Measurement,
  type Phase,
  type Setting,
  type Result,
} from "@starplus/core";
import { PageHeader } from "@/components/dashboard/page-header";
import { RequireSession } from "@/components/require-session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deviceDb, profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";
import { finishOutcome, useDailyPlan, type DailyStep } from "@/lib/daily-plan";
import { getKbEntry } from "@/lib/kb";
import { getSession } from "@/lib/session";
import { assessAndQueue } from "@/lib/assess-run";
import { enqueueMeasurement } from "@/lib/outbox";

const SKIP_REASONS = ["No device", "Not feeling well", "Later"] as const;
const TYPICAL = "about 15 s";

function skipsKey(day: string): string {
  return `daily-skips-${day}`;
}

function readSkips(day: string): Record<string, string> {
  try {
    return JSON.parse(window.sessionStorage.getItem(skipsKey(day)) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function DailyCheckContent() {
  const session = useActiveCrew();
  const crewId = session.status === "active" ? session.crewId : null;

  return (
    <RequireSession session={session}>
      {crewId ? <DailyRun crewId={crewId} /> : null}
    </RequireSession>
  );
}

export default function DailyCheckPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <DailyCheckContent />
    </Suspense>
  );
}

function DailyRun({ crewId }: { crewId: string }) {
  const plan = useDailyPlan(crewId);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = todayLocal(timeZone);

  const [skips, setSkips] = React.useState<Record<string, string>>({});
  const [skipFor, setSkipFor] = React.useState<DailyStep | null>(null);
  const [recorded, setRecorded] = React.useState<string[]>([]);
  const [value, setValue] = React.useState("");
  const [diastolic, setDiastolic] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const [streak, setStreak] = React.useState<{ days: number; patches: number } | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setSkips(readSkips(day)), 0);
    return () => window.clearTimeout(timer);
  }, [day]);

  const steps = plan?.steps ?? [];
  const isDone = (step: DailyStep) => step.done || recorded.includes(step.key);
  const remaining = steps.filter((step) => !isDone(step) && !skips[step.key]);
  const current = remaining[0] ?? null;
  const doneCount = steps.filter((step) => isDone(step)).length;
  const total = steps.length || 8;
  const position = Math.min(doneCount + Object.keys(skips).length + 1, total);

  const measure = current ? lookupMeasure(current.metrics[0]) : null;
  const how = measure ? (getKbEntry(measure.guidance_key)?.text[0] ?? "") : "";

  async function record() {
    if (!current || !measure || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const device_id = (await (await deviceDb()).get("settings", "device_id"))?.value ?? "unknown-device";
      const live = await getSession(crewId);
      const setting = ((await (await deviceDb()).get("settings", "setting"))?.value ?? "iss") as Setting;
      const phase = ((await (await deviceDb()).get("settings", "phase"))?.value ?? "inflight") as Phase;
      const base = {
        crew_id: crewId,
        device_id,
        setting,
        phase,
        provenance: (live?.provenance ?? "real") as "real" | "synthetic" | "simulated_device",
        confirmed_by_user: false,
      };
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        setNotice("Enter a number.");
        return;
      }
      const pair = current.metrics.length > 1;
      const capture_id = pair ? crypto.randomUUID() : undefined;
      const drafts = [
        { metric: current.metrics[0], value: parsed, unit: measure.unit, source: "manual" as const, confidence: 1, capture_id, howto: how, why: "" },
      ];
      if (pair) {
        const dia = Number(diastolic);
        if (!Number.isFinite(dia)) {
          setNotice("Enter the diastolic value as well; blood pressure goes together.");
          return;
        }
        drafts.push({
          metric: current.metrics[1],
          value: dia,
          unit: measure.unit,
          source: "manual" as const,
          confidence: 1,
          capture_id,
          howto: "",
          why: "",
        });
      }
      const records: Measurement[] = [];
      for (const draft of drafts) {
        const normalised = normalise(draft, base);
        if (!normalised.ok) {
          setNotice(normalised.reasons.join(" "));
          return;
        }
        const checked = validateRecord(normalised.value);
        if (!checked.ok) {
          setNotice(checked.reasons.join(" "));
          return;
        }
        records.push(checked.value);
      }
      for (const record of records) await enqueueMeasurement(crewId, record);
      setRecorded((prev) => [...prev, current.key]);
      setValue("");
      setDiastolic("");
    } finally {
      setBusy(false);
    }
  }

  function skip(reason: string) {
    if (!skipFor) return;
    const next = { ...skips, [skipFor.key]: reason };
    setSkips(next);
    window.sessionStorage.setItem(skipsKey(day), JSON.stringify(next));
    setSkipFor(null);
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      const device = await deviceDb();
      const setting = (await device.get("settings", "setting"))?.value ?? "iss";
      const phase = ((await device.get("settings", "phase"))?.value ?? "inflight") as Phase;
      const db = await profileDb(crewId);
      const existing = await db.getAll("results");
      const latest =
        [...existing].sort((a, b) => Date.parse(a.assessed_at) - Date.parse(b.assessed_at)).pop() ?? null;
      const outcome = finishOutcome(recorded.length, latest ?? null);
      if (outcome.assess) {
        setResult(await assessAndQueue(crewId, [], { setting, phase }));
      } else {
        setResult(outcome.resultId ? latest : null);
      }

      const [measurements, results, sessionRow] = await Promise.all([
        db.getAll("measurements"),
        db.getAll("results"),
        getSession(crewId),
      ]);
      const demo = Boolean(sessionRow?.demo);
      const days = scoreDays(measurements, results, demo ? { includeSynthetic: true } : {});
      const today = todayLocal(timeZone);
      const count = streakDays(
        days.filter((entry) => entry.points > 0).map((entry) => entry.day),
        today
      );
      setStreak({ days: count, patches: patchesForStreak(count).length });
      setFinished(true);
    } finally {
      setFinishing(false);
    }
  }

  if (!plan) return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;

  if (finished) {
    const left = total - doneCount;
    const skipped = Object.entries(skips);
    const nextPatch = MISSION_PATCHES.find((patch) => patch.days > (streak?.days ?? 0));
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
        <PageHeader eyebrow="TODAY'S CHECK" title={left > 0 ? `Today's check: ${doneCount} of ${total}` : "Today's check complete"} />
        <Card className="mt-4 p-5">
          <p className="text-sm text-muted">
            {left > 0
              ? `${doneCount} of ${total} recorded. The rest stay open until tomorrow.`
              : "All steps recorded. Nothing here judges your values — the result page does that."}
          </p>
          {skipped.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {skipped.map(([key, reason]) => (
                <li key={key} className="flex justify-between gap-3 border-b border-border py-1 text-muted">
                  <span>{steps.find((step) => step.key === key)?.label ?? key}</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
          {streak && (
            <p className="mt-4 text-sm text-foreground">
              {streak.days} {streak.days === 1 ? "day" : "days"} in a row · {streak.patches} patch
              {streak.patches === 1 ? "" : "es"}
              {nextPatch ? ` · ${nextPatch.days - streak.days} days to ${nextPatch.name}` : ""}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            {result && (
              <Button asChild>
                <Link href={`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(result.client_id)}`}>
                  See your result
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/">Back to Today</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader eyebrow="TODAY'S CHECK" title="Today's check" />
      <p className="mt-1 text-sm text-muted">One measure per screen. {TYPICAL} each.</p>

      <div className="mt-4" data-testid="daily-progress">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{`Step ${position} of ${total}`}</span>
          <span>{`${doneCount} done`}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent-strong" style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2 text-xs">
        {steps.map((step) => (
          <li key={step.key} className={isDone(step) ? "rounded-full bg-surface px-2 py-1 text-foreground" : "rounded-full bg-surface-2 px-2 py-1 text-muted"}>
            {isDone(step) ? `✓ ${step.label}` : step.label}
          </li>
        ))}
      </ul>

      {current && measure ? (
        <Card className="mt-4 p-5">
          <h2 className="text-lg font-semibold text-foreground">{current.label}</h2>
          {how && <p className="mt-1 text-sm text-muted">{how}</p>}
          <p className="mt-1 text-xs text-muted">
            {`Plausible range ${measure.bounds.min}–${measure.bounds.max} ${measure.unit}`.trim()}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void record();
            }}
          >
            <label className="block text-sm" htmlFor="daily-value">
              {current.metrics.length > 1 ? "Systolic" : "Value"}
              <input
                id="daily-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-control border border-input bg-surface px-3 py-2 text-foreground"
              />
            </label>
            {current.metrics.length > 1 && (
              <label className="block text-sm" htmlFor="daily-diastolic">
                Diastolic
                <input
                  id="daily-diastolic"
                  inputMode="decimal"
                  value={diastolic}
                  onChange={(event) => setDiastolic(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-control border border-input bg-surface px-3 py-2 text-foreground"
                />
              </label>
            )}
            {notice && (
              <p role="alert" className="text-sm text-danger">
                {notice}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                Record and next
              </Button>
              <Button type="button" variant="outline" onClick={() => setSkipFor(current)}>
                Skip
              </Button>
              <Button type="button" variant="ghost" onClick={() => void finish()} disabled={finishing}>
                Finish now
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">
            Use a device instead:{" "}
            <Link href="/check/bluetooth" className="text-accent-strong underline">Bluetooth</Link>,{" "}
            <Link href="/check/camera" className="text-accent-strong underline">camera</Link>,{" "}
            <Link href="/check/voice" className="text-accent-strong underline">voice</Link>.
          </p>
        </Card>
      ) : (
        <Card className="mt-4 p-5">
          <p className="text-sm text-muted">Nothing left to record today.</p>
          <Button className="mt-3" onClick={() => void finish()} disabled={finishing}>
            Finish
          </Button>
        </Card>
      )}

      {skipFor && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <Card className="w-full max-w-sm p-5">
            <h2 className="text-base font-semibold text-foreground">Skip {skipFor.label} today?</h2>
            <p className="mt-1 text-sm text-muted">Why?</p>
            <div className="mt-3 space-y-2">
              {SKIP_REASONS.map((reason) => (
                <Button key={reason} variant="outline" className="w-full justify-start" onClick={() => skip(reason)}>
                  {reason}
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setSkipFor(null)}>
              Keep it
            </Button>
          </Card>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/" className="underline">Back to Today</Link>
      </p>
    </div>
  );
}
