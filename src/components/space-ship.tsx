"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const SpaceShipScene = dynamic(() => import("./space-ship-scene"), { ssr: false });

const LAP_MS = 78_000;
const WAVES = 1.4;

/** Deterministic per-lap variation, so each flight path differs from the last. */
function jitter(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function SpaceShip() {
  const [mount, setMount] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const track = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // A 3D layer the size of this one is decoration: never spend it on a browser
    // that is being driven by a test runner or that asked for reduced motion.
    if (window.navigator.webdriver) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setMount(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const element = track.current;
    if (!ready || !element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.style.transform = "translate3d(8vw, 58vh, 0) rotate(-6deg)";
      return;
    }

    let frame = 0;
    let last = performance.now();
    let elapsed = 0.12;
    let lap = 0;
    let amplitude = 0.05;
    let band = 0.34;

    const tick = (now: number) => {
      elapsed += Math.min(64, now - last) / LAP_MS;
      last = now;

      if (elapsed >= 1) {
        elapsed -= 1;
        lap += 1;
        amplitude = 0.035 + jitter(lap) * 0.055;
        band = 0.28 + jitter(lap + 7) * 0.22;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const span = width * 1.6;
      const x = -width * 0.3 + elapsed * span;

      const phase = elapsed * Math.PI * 2 * WAVES + lap;
      const y = height * band + Math.sin(phase) * height * amplitude;
      const slope = Math.cos(phase) * height * amplitude * Math.PI * 2 * WAVES;
      const angle = Math.atan2(slope, span) * (180 / Math.PI);

      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  if (!mount) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[15] select-none overflow-hidden">
      <div ref={track} className={cn("ship-track", ready && "ship-visible")}>
        <SpaceShipScene onReady={() => setReady(true)} />
      </div>
    </div>
  );
}
