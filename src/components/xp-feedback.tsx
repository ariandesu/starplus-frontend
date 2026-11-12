"use client";

import { useEffect, useState } from "react";
import type { XpSummary } from "@/lib/xp";

/** True when the user asked for no motion. Used to skip count-ups, particles and vibration. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** A short haptic tick where supported, never under reduced motion. */
export function buzz(pattern: number | number[], reduced: boolean): void {
  if (reduced) return;
  try {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* haptics are best-effort */
  }
}

/** Counts from `from` to `to` over `durationMs`, or jumps straight there when reduced. */
export function useCountUp(to: number, from: number, durationMs: number, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? to : from);
  useEffect(() => {
    if (reduced || from === to) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(from + (to - from) * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, from, durationMs, reduced]);
  return reduced ? to : value;
}

/** The floating "+10 XP" chip after a recorded step. Motion is CSS-only. */
export function XpGainChip({ amount }: { amount: number }) {
  return (
    <p data-testid="xp-gain" aria-live="polite" className="xp-gain-chip">
      +{amount} XP
    </p>
  );
}

/** Rank badge, total XP and the bar to the next level. */
export function XpHeaderBar({ xp }: { xp: XpSummary | null }) {
  const range = xp && xp.nextLevelAt !== null ? xp.nextLevelAt - xp.levelFloor : 1;
  const done = xp ? Math.min(Math.max(xp.total - xp.levelFloor, 0), range) : 0;
  return (
    <div className="mt-4 rounded-tile border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Level {xp?.level ?? 1} · {xp?.rank ?? "Cadet"}
        </p>
        <p className="text-sm text-muted">
          {xp ? (xp.nextLevelAt !== null ? `${xp.total} / ${xp.nextLevelAt} XP` : `${xp.total} XP · top rank`) : "Loading XP…"}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="XP to the next rank"
        aria-valuenow={xp?.total ?? 0}
        aria-valuemin={xp?.levelFloor ?? 0}
        aria-valuemax={xp?.nextLevelAt ?? 1}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="xp-bar-fill h-full rounded-full bg-accent" style={{ width: `${(done / range) * 100}%` }} />
      </div>
    </div>
  );
}

/** Dismissible "+N XP" toast on the result page. It sits in the flow above the status. */
export function XpToast({ amount, onDismiss }: { amount: number; onDismiss: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-tile border border-border bg-card px-4 py-3">
      <p aria-live="polite" className="text-sm font-semibold text-foreground">
        +{amount} XP
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss XP toast"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-sm text-muted focus-ring"
      >
        Dismiss
      </button>
    </div>
  );
}

const PARTICLES = [
  { x: 0, y: -44 }, { x: 31, y: -31 }, { x: 44, y: 0 }, { x: 31, y: 31 },
  { x: 0, y: 44 }, { x: -31, y: 31 }, { x: -44, y: 0 }, { x: -31, y: -31 },
  { x: 20, y: -40 }, { x: -20, y: 40 },
];

/**
 * Full-check celebration: a tick that draws in, a small star burst, the
 * "+50 XP" banner and the total counting up. Under reduced motion the same
 * text and a static tick appear with no movement.
 */
export function FullCheckCelebration({
  oldTotal,
  newTotal,
  newRank,
}: {
  oldTotal: number;
  newTotal: number;
  newRank: string | null;
}) {
  const reduced = useReducedMotion();
  const shown = useCountUp(newTotal, oldTotal, 800, reduced);
  return (
    <div className="mt-4 rounded-tile border border-border bg-card p-5 text-center">
      <div className="xp-tick-wrap" aria-hidden>
        <svg viewBox="0 0 64 64" className="mx-auto h-16 w-16">
          <circle cx="32" cy="32" r="29" fill="none" stroke="var(--accent)" strokeWidth="3" className="xp-tick-ring" />
          <path
            d="M20 33 L29 42 L45 24"
            fill="none"
            stroke="var(--accent-strong)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="xp-tick-path"
          />
        </svg>
        <span className="xp-particles" aria-hidden>
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="xp-particle"
              style={{ "--tx": `${p.x}px`, "--ty": `${p.y}px` } as React.CSSProperties}
            />
          ))}
        </span>
      </div>
      <p className="mt-2 text-base font-semibold text-foreground">Full check +50 XP</p>
      <p className="mt-1 text-sm text-muted" aria-live="polite">
        {shown} XP total
      </p>
      {newRank && (
        <p aria-live="polite" className="xp-rank-up mx-auto mt-2 inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
          Rank up: {newRank}
        </p>
      )}
    </div>
  );
}
