"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Phase } from "@starplus/core";
import { assessAndQueue } from "@/lib/assess-and-queue";
import { reactionToRecord } from "@/lib/adapters/reaction-test";
import { deviceDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { useActiveCrew } from "@/lib/use-active-crew";
import { RequireSession } from "@/components/require-session";

type Stage = "idle" | "waiting" | "tap" | "done";

function ReactionTest() {
  const router = useRouter();
  const session = useActiveCrew();
  const { crewId, ready: crewReady } = session;
  const [stage, setStage] = useState<Stage>("idle");
  const [taps, setTaps] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const begin = useCallback(() => {
    setNotice(null);
    setTaps([]);
    setStage("waiting");
    const delay = 1000 + Math.floor(Math.random() * 3000);
    timerRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setStage("tap");
    }, delay);
  }, []);

  const tap = useCallback(() => {
    setTaps((prev) => [...prev, Date.now() - startRef.current]);
  }, []);

  useEffect(() => {
    if (stage === "tap" && taps.length >= 6) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const id = setTimeout(() => setStage("done"), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [stage, taps]);

  async function save() {
    if (!crewId) return;
    setNotice(null);
    setBusy(true);
    try {
      const session = await getSession(crewId);
      if (!session) {
        setNotice("Log in first, then take the test.");
        return;
      }
      const db = await deviceDb();
      const device = await db.get("settings", "device_id");
      const deviceId = typeof device?.value === "string" && device.value ? device.value : "reaction-test";
      const built = reactionToRecord(taps, {
        crewId,
        provenance: (session.provenance ?? "real") as "real" | "synthetic" | "simulated_device",
        deviceId,
        setting: "iss",
        phase: "inflight" as Phase,
        phaseDay: null,
      });
      if (!("record" in built)) {
        setNotice(built.error);
        return;
      }
      const resultId = await assessAndQueue(crewId, "inflight", [built.record]);
      router.push(`/result?crew=${encodeURIComponent(crewId)}&result=${encodeURIComponent(resultId)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!crewReady) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} />;
  }

  return (
    <div className="mx-4 my-6 w-auto max-w-2xl rounded-card border border-border bg-card p-5 shadow-card sm:mx-auto lg:p-6">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Reaction test</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tap as soon as you see “Tap now”. First tap is practice, then five count.</p>
      {stage === "idle" && (
        <button
          type="button"
          onClick={begin}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground"
        >
          Start test
        </button>
      )}
      {stage === "waiting" && (
        <div className="mt-4 rounded-xl bg-muted/40 p-8 text-center text-lg text-muted-foreground">Wait for it…</div>
      )}
      {stage === "tap" && (
        <button
          type="button"
          onClick={tap}
          className="mt-4 w-full rounded-xl bg-danger px-4 py-10 text-2xl font-bold text-danger-foreground"
        >
          Tap now! ({Math.max(0, 6 - taps.length)} left)
        </button>
      )}
      {stage === "done" && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {taps.length} taps recorded. Median reaction time: {Math.round(taps.slice(1).sort((a, b) => a - b)[Math.floor((taps.length - 1) / 2)])} ms (practice tap excluded).
          </p>
          <button
            type="button"
            onClick={() => {
              void save();
            }}
            disabled={busy}
            className="mt-2 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save result"}
          </button>
          <button type="button" onClick={begin} className="mt-2 w-full text-sm text-accent-strong underline">
            Try again
          </button>
        </div>
      )}
      {notice && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}

export default function ReactionPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ReactionTest />
    </Suspense>
  );
}
