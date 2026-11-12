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
import { useXp } from "@/lib/xp";
import { ReadinessRing } from "@/components/readiness-ring";
import { XpHeaderBar } from "@/components/xp-feedback";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";

function ProgressView() {
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const { xp } = useXp(crewReady && session.status === "active" ? crewId : null);
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
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const db = await profileDb(crewId);
        const measurements = await db.getAll("measurements");
        const results = await db.getAll("results");
        const days = scoreDays(measurements, results, { timeZone, ...(demo ? { includeSynthetic: true } : {}) });
        const now = todayLocal(timeZone);
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

  if (!ready) return <p className="px-4 py-8 text-sm text-muted">Loading progress…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="PROGRESS"
        title="Progress"
        actions={
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={enabled} onChange={(event) => toggle(event.target.checked)} />
            Gamification
          </label>
        }
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      {enabled ? (
        <>
          <XpHeaderBar xp={xp} />
          <Card className="mt-4 p-5 lg:p-6">
            <section aria-label="Daily readiness">
              <h2 className="text-lg font-semibold text-foreground">Today&apos;s readiness</h2>
              <div className="mt-3">
                <ReadinessRing
                  checkIn={today?.checkIn ?? false}
                  exercise={today?.exercise ?? false}
                  sleep={today?.sleep ?? false}
                  hydration={today?.hydration ?? false}
                />
              </div>
            </section>
          </Card>

          <Card className="mt-4 p-5 lg:p-6">
            <section aria-label="Streak">
              <h2 className="text-lg font-semibold text-foreground">Streak</h2>
              <p className="mt-2 text-sm text-foreground">
                {streak} {streak === 1 ? "day" : "days"} in a row (one rest day a week is allowed).
              </p>
              {patches.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {patches.map((patch) => (
                    <li key={patch.id}>
                      <Badge>{patch.name}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">Log every day for a week to earn your first patch.</p>
              )}
            </section>
          </Card>
        </>
      ) : (
        <Card className="mt-4 p-5">
          <p className="text-sm text-muted">Gamification is switched off on this device.</p>
        </Card>
      )}

      <Card className="mt-4 p-5 lg:p-6">
        <section aria-label="Crew progress">
          <h2 className="text-lg font-semibold text-foreground">Crew progress</h2>
          {crewPct === null ? (
            <p className="mt-2 text-sm text-muted">Crew progress is available when the link is up.</p>
          ) : (
            <>
              <div className="mt-3">
                <ProgressBar value={crewPct} max={100} label="Crew progress" />
              </div>
              <p className="mt-2 text-sm text-foreground">
                {`${crewPct}% of expected check-ins over the last 7 days (crew-wide, excluding watch and critical).`}
              </p>
            </>
          )}
        </section>
      </Card>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading progress…</p>}>
      <ProgressView />
    </Suspense>
  );
}
