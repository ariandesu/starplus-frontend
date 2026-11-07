"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { profileDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { Result } from "@starplus/core";

function HomeView() {
  const params = useSearchParams();
  const crewId = params.get("crew") ?? "";
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [latest, setLatest] = useState<Result | null>(null);

  useEffect(() => {
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      setLoggedIn(!!(await getSession(crewId)));
      try {
        const db = await profileDb(crewId);
        const results = await db.getAllFromIndex("results", "by-assessed");
        setLatest(results.length > 0 ? results[results.length - 1] : null);
      } catch {
        setLatest(null);
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;

  if (!crewId || !loggedIn) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground">STAR PLUS self-check</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answer three questions: how am I, why, and what do I do now. Your data stays on this
          device until a link returns.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            Log in
          </Link>
          <Link
            href="/emergency"
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white"
          >
            Emergency
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Today</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reminder: take today&apos;s check-in — two measures, under a minute.
      </p>
      <div className="mt-4">
        <EmptyState
          tone={latest ? (latest.overall_status === "insufficient" ? "insufficient" : latest.overall_status === "nominal" ? "normal" : latest.overall_status) : "insufficient"}
          title={
            latest
              ? `Overall: ${latest.overall_status}`
              : "No check-in yet"
          }
          description={
            latest
              ? `Last assessed ${new Date(latest.assessed_at).toUTCString()}.`
              : "Your first self-check starts your personal baseline."
          }
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/check?crew=${encodeURIComponent(crewId)}`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        >
          Start self-check
        </Link>
        <Link
          href={`/reports?crew=${encodeURIComponent(crewId)}`}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground"
        >
          Reports
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <HomeView />
    </Suspense>
  );
}
