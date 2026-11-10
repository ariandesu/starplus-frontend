"use client";

import * as React from "react";
import Link from "next/link";
import { scoreDays, streakDays, todayLocal, type DayScore, type Measurement, type Result } from "@starplus/core";
import { Card, CardHeader } from "@/components/ui/card";
import { ChecklistRow } from "@/components/dashboard/checklist-row";
import { ReadinessRing } from "@/components/readiness-ring";

interface ReadinessCardProps {
  measurements: Measurement[];
  results: Result[];
  demo: boolean;
}

function readiness(measurements: Measurement[], results: Result[], demo: boolean): { today: DayScore | null; streak: number } {
  const days = scoreDays(measurements, results, demo ? { includeSynthetic: true } : {});
  const day = todayLocal();
  const today = days.find((entry) => entry.day === day) ?? null;
  const streak = streakDays(
    days.filter((entry) => entry.points > 0).map((entry) => entry.day),
    day
  );
  return { today, streak };
}

export function ReadinessCard({ measurements, results, demo }: ReadinessCardProps) {
  const { today, streak } = readiness(measurements, results, demo);
  return (
    <Card className="h-full p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title="Readiness"
        action={
          <Link href="/progress" className="inline-flex min-h-11 items-center text-sm font-medium text-accent-strong underline underline-offset-4 focus-ring">
            Progress
          </Link>
        }
      />
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <ReadinessRing
          checkIn={today?.checkIn ?? false}
          exercise={today?.exercise ?? false}
          sleep={today?.sleep ?? false}
          hydration={today?.hydration ?? false}
        />
        <div className="w-full flex-1 space-y-2">
          <ChecklistRow label="Check-in" done={today?.checkIn ?? false} />
          <ChecklistRow label="Exercise" done={today?.exercise ?? false} />
          <ChecklistRow label="Sleep" done={today?.sleep ?? false} />
          <ChecklistRow label="Hydration" done={today?.hydration ?? false} />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        {`${streak} ${streak === 1 ? "day" : "days"} in a row (one rest day a week is allowed).`}
      </p>
    </Card>
  );
}
