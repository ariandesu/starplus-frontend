"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { WaitingBanner } from "@/components/waiting-banner";
import { profileDb } from "@/lib/db";
import { getSession, hasActiveSession } from "@/lib/session";
import { onSynced } from "@/lib/outbox-sync";
import { pendingEmergencyCount } from "@/lib/outbox";
import type { Result } from "@starplus/core";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

function HomeView() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [latest, setLatest] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refreshWaiting = async () => {
      const [count, session] = await Promise.all([pendingEmergencyCount(), hasActiveSession()]);
      if (!cancelled) {
        setWaiting(count > 0);
        setHasSession(session);
      }
    };
    void refreshWaiting().catch(() => undefined);
    const offSynced = onSynced(() => {
      void refreshWaiting().catch(() => undefined);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshWaiting().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      offSynced();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      try {
        const session = await getSession(crewId);
        if (session && (session.role === "flight_medical_officer" || session.role === "mission_control")) {
          router.replace("/surgeon");
          return;
        }
        const db = await profileDb(crewId);
        const results = await db.getAllFromIndex("results", "by-assessed");
        setLatest(results.length > 0 ? results[results.length - 1] : null);
      } catch {
        setLatest(null);
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId, crewReady, router]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;

  if (session.status !== "active" || !crewId) {
    return (
      <RequireSession
        session={session}
        heading="STAR PLUS self-check"
        intro="Answer three questions: how am I, why, and what do I do now. Your data stays on this device until a link returns."
        showEmergency
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Today</h1>
      <WaitingBanner waiting={waiting} hasSession={hasSession} />
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
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
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
