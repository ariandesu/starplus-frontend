"use client";

import { Suspense, useEffect, useState } from "react";
import {
  patchesForStreak,
  scoreDays,
  streakDays,
  todayLocal,
  type DayScore,
  type MissionPatch,
} from "@starplus/core";
import { getCrewProgress } from "@/lib/api";
import { profileDb } from "@/lib/db";
import { gamificationEnabled, setGamificationEnabled } from "@/lib/gamification-settings";
import { getSession } from "@/lib/session";
import { ReadinessRing } from "@/components/readiness-ring";
import { useActiveCrew } from "@/lib/use-active-crew";
import { ContinueAsButtons } from "@/components/continue-as";

function ProgressView() {
  const { crewId, ready: crewReady, candidates } = useActiveCrew();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(() => gamificationEnabled());
  const [today, setToday] = useState<DayScore | null>(null);
  const [streak, setStreak] = useState(0);
  const [patches, setPatches] = useState<MissionPatch[]>([]);
  const [crewPct, setCrewPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      try {
        const session = await getSession(crewId);
        const demo = session?.demo ?? false;
        const db = await profileDb(crewId);
        const measurements = await db.getAll("measurements");
        const results = await db.getAll("results");
        const days = scoreDays(measurements, results, demo ? { includeSynthetic: true } : {});
        const now = todayLocal();
        setToday(days.find((day) => day.day === now) ?? null);
        const streakCount = streakDays(
          days.filter((day) => day.points > 0).map((day) => day.day),
          now
        );
        setStreak(streakCount);
        setPatches(patchesForStreak(streakCount));
        if (session) {
          const progress = await getCrewProgress(session.token);
          setCrewPct(progress.readiness_pct);
        }
      } catch {
        setError("Could not load progress. Check the link and try again.");
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  function toggle(next: boolean) {
    setEnabled(next);
    setGamificationEnabled(next);
  }

  if (!ready) return <main className="p-6">Loading progress…</main>;
  if (!crewId) {
    return (
      <main className="p-6">
        <p>Open this page from the app with your crew link.</p>
        <p className="mt-2">
          <a className="underline" href="/login">
            Go to login
          </a>{" "}
          <a className="underline" href="/login?demo=astronaut">
            Try the demo
          </a>
        </p>
        <ContinueAsButtons candidates={candidates} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Progress</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={enabled} onChange={(event) => toggle(event.target.checked)} />
          Gamification
        </label>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {enabled ? (
        <>
          <section aria-label="Daily readiness">
            <h2 className="mb-2 text-lg font-semibold">Today&apos;s readiness</h2>
            <ReadinessRing
              checkIn={today?.checkIn ?? false}
              exercise={today?.exercise ?? false}
              sleep={today?.sleep ?? false}
              hydration={today?.hydration ?? false}
            />
          </section>
          <section aria-label="Streak">
            <h2 className="mb-2 text-lg font-semibold">Streak</h2>
            <p className="text-sm text-slate-700">
              {streak} {streak === 1 ? "day" : "days"} in a row (one rest day a week is allowed).
            </p>
            {patches.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {patches.map((patch) => (
                  <li key={patch.id} className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900">
                    {patch.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Log every day for a week to earn your first patch.</p>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm text-slate-500">Gamification is switched off on this device.</p>
      )}
      <section aria-label="Crew progress">
        <h2 className="mb-2 text-lg font-semibold">Crew progress</h2>
        <p className="text-sm text-slate-700">
          {crewPct === null
            ? "Crew progress is available when the link is up."
            : `${crewPct}% of expected check-ins over the last 7 days (crew-wide, excluding watch and critical).`}
        </p>
      </section>
    </main>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading progress…</main>}>
      <ProgressView />
    </Suspense>
  );
}
