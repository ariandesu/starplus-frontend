"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import type { Measurement } from "@starplus/core";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { profileDb } from "@/lib/db";
import { summarizeFitness } from "@/lib/fitness-summary";
import { shortDate } from "@/lib/report-title";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

function FitnessReportView() {
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      try {
        setMeasurements(await (await profileDb(crewId)).getAll("measurements"));
      } catch {
        setMeasurements([]);
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  if (session.status !== "active" || !crewId) {
    return (
      <RequireSession
        session={session}
        heading="Fitness report"
        intro="Log in to see the printable fitness report."
      />
    );
  }

  if (!ready) return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;

  const fitness = summarizeFitness(measurements);
  const empty = fitness.checkinDays7d === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow="ONBOARD REPORT"
        title="Fitness report"
        actions={
          <Button type="button" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        }
      />
      <p className="mt-1 text-sm text-muted">
        Last 7 days, from logged readings on this device. Totals only — activity and mass are
        baseline-scored with no published fitness limits.
      </p>
      {empty ? (
        <p className="mt-4 text-sm text-muted">No check-ins in the last 7 days.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Activity</h2>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {fitness.activeMinutes7d} <span className="text-base font-medium text-muted">active minutes</span>
            </p>
            {fitness.activeDays.length > 0 ? (
              <ul aria-label="Daily active minutes" className="mt-2 space-y-1 text-sm text-muted">
                {fitness.activeDays.map((day) => (
                  <li key={day.date}>
                    {day.date}: {day.minutes} min
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">No exercise logged in the last 7 days.</p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Sleep and recovery</h2>
            <p className="mt-1 text-sm text-foreground">
              {fitness.avgSleep7d !== null
                ? `Average ${fitness.avgSleep7d.toFixed(1)} h over ${fitness.sleepNights} ${fitness.sleepNights === 1 ? "night" : "nights"}.`
                : "No sleep logged in the last 7 days."}
            </p>
            <p className="mt-1 text-sm text-foreground">
              Check-ins on {fitness.checkinDays7d} of the last 7 days.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-semibold">Body mass</h2>
            <p className="mt-1 text-sm text-foreground">
              {fitness.latestMassKg !== null
                ? `Latest ${fitness.latestMassKg} kg${fitness.latestMassAt ? ` on ${shortDate(fitness.latestMassAt)}` : ""}${
                    fitness.massDelta30dKg !== null
                      ? ` (${fitness.massDelta30dKg > 0 ? "+" : ""}${fitness.massDelta30dKg.toFixed(1)} kg in 30 days)`
                      : ""
                  }.`
                : "No body mass logged."}
            </p>
          </Card>
        </div>
      )}
      <p className="mt-4 text-sm">
        <Link className="underline" href="/progress">
          Today&apos;s readiness
        </Link>{" "}
        ·{" "}
        <Link className="underline" href="/hazards">
          Mission hazards
        </Link>
      </p>
    </div>
  );
}

export default function FitnessReportPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <FitnessReportView />
    </Suspense>
  );
}
