"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Measurement } from "@starplus/core";
import { StatCount } from "@/components/dashboard/stat-count";
import { MeasuresCard } from "@/components/home/measures-card";
import { ReadinessCard } from "@/components/home/readiness-card";
import { ReportsCard } from "@/components/home/reports-card";
import { StatusHero } from "@/components/home/status-hero";
import { SystemsCard } from "@/components/home/systems-card";
import { TrendCard } from "@/components/home/trend-card";
import { RequireSession } from "@/components/require-session";
import { Skeleton } from "@/components/ui/skeleton";
import { WaitingBanner } from "@/components/waiting-banner";
import { deviceDb } from "@/lib/db";
import { gamificationEnabled } from "@/lib/gamification-settings";
import { summarySentence } from "@/lib/health-summary";
import { pendingEmergencyCount } from "@/lib/outbox";
import { onSynced } from "@/lib/outbox-sync";
import { getSession, hasActiveSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { useHealthSummary } from "@/lib/use-health-summary";
import { buildSeries, type MetricSeries } from "@/lib/vital-series";
import { KEY_VITALS } from "@/lib/vital-order";

function greetingText(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function eyebrowDate(): string {
  const date = new Date();
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function firstTrend(measurements: Measurement[]): MetricSeries | null {
  const now = Date.now();
  for (const code of KEY_VITALS) {
    const series = buildSeries(measurements, code, now);
    if (series && series.points.length >= 2) return series;
  }
  return null;
}

function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="lg:col-span-12" height="2rem" width="16rem" />
        <Skeleton className="lg:col-span-7" height="12rem" />
        <Skeleton className="lg:col-span-5" height="12rem" />
        <Skeleton className="lg:col-span-4" height="10rem" />
        <Skeleton className="lg:col-span-4" height="10rem" />
        <Skeleton className="lg:col-span-4" height="10rem" />
      </div>
    </div>
  );
}

function HomeView() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, crew, ready: crewReady } = session;
  const summary = useHealthSummary(crewId);
  const [ready, setReady] = useState(false);
  const [surgeon, setSurgeon] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [setting, setSetting] = useState("iss");
  const [phase, setPhase] = useState("inflight");

  useEffect(() => {
    let cancelled = false;
    const refreshWaiting = async () => {
      const [count, live] = await Promise.all([pendingEmergencyCount(), hasActiveSession()]);
      if (!cancelled) {
        setWaiting(count > 0);
        setHasSession(live);
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
    let cancelled = false;
    (async () => {
      if (!crewReady) return;
      if (!crewId) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const live = await getSession(crewId);
        if (live && (live.role === "flight_medical_officer" || live.role === "mission_control")) {
          if (!cancelled) setSurgeon(true);
          router.replace("/surgeon");
          return;
        }
      } catch {
        // Fall through to the astronaut view; the session layer reports its own state.
      }
      if (!cancelled) setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, [crewId, crewReady, router]);

  useEffect(() => {
    deviceDb()
      .then(async (db) => {
        const [settingRow, phaseRow] = await Promise.all([
          db.get("settings", "setting"),
          db.get("settings", "phase"),
        ]);
        if (settingRow?.value) setSetting(settingRow.value);
        if (phaseRow?.value) setPhase(phaseRow.value);
      })
      .catch(() => undefined);
  }, []);

  if (!ready || surgeon) return <HomeSkeleton />;

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

  if (!summary.ready) return <HomeSkeleton />;

  const { counts, latestResult, entries, measurements, results, reports } = summary;
  const checkHref = `/check?crew=${encodeURIComponent(crewId)}`;
  const reportsHref = `/reports?crew=${encodeURIComponent(crewId)}`;
  const trend = firstTrend(measurements);
  const showReadiness = gamificationEnabled();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        <header className="md:col-span-2 lg:order-1 lg:col-span-12">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted">
            {`${eyebrowDate()} · ${setting} · ${phase}`}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-[1.75rem] font-bold tracking-tight">Today</h1>
            <p className="text-[1.75rem] font-normal tracking-tight text-muted">
              {`${greetingText(new Date().getHours())}, ${crew?.name ?? ""}. ${summarySentence(counts)}`}
            </p>
          </div>
          <WaitingBanner waiting={waiting} hasSession={hasSession} />
        </header>

        <div className="space-y-4 md:col-span-1 lg:order-3 lg:col-span-5">
          <StatusHero
            status={latestResult?.overall_status ?? null}
            assessedAt={latestResult?.assessed_at ?? null}
            checkHref={checkHref}
            reportsHref={reportsHref}
          />
          <div className="grid grid-cols-2 gap-4">
            <StatCount value={counts.nominal} label="Nominal" status="nominal" />
            <StatCount value={counts.watch} label="Watch" status="watch" />
            <StatCount value={counts.critical} label="Critical" status="critical" />
            <StatCount value={counts.insufficient} label="No baseline" status="insufficient" />
          </div>
        </div>

        <div className="md:col-span-1 lg:order-2 lg:col-span-7">
          <MeasuresCard entries={entries} checkHref={checkHref} />
        </div>

        {showReadiness && (
          <div className="md:col-span-1 lg:order-4 lg:col-span-4">
            <ReadinessCard measurements={measurements} results={results} demo={Boolean(crew?.demo)} />
          </div>
        )}

        {trend && (
          <div className="md:col-span-1 lg:order-5 lg:col-span-4">
            <TrendCard series={trend} />
          </div>
        )}

        <div className="md:col-span-2 lg:order-6 lg:col-span-4">
          <SystemsCard entries={entries} />
        </div>

        {reports.length > 0 && (
          <div className="md:col-span-2 lg:order-7 lg:col-span-12">
            <ReportsCard reports={reports} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeView />
    </Suspense>
  );
}
