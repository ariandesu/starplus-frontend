"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function markerPosition(z: number | null): number | null {
  if (z === null) return null;
  return Math.min(Math.max((z + 3) / 6, 0), 1);
}

const TICKS = Array.from({ length: 21 }, (_, index) => index);
const CENTRE_TICK = 10;

interface RangeBarProps {
  zScore: number | null;
  ariaLabel: string;
  className?: string;
}

export function RangeBar({ zScore, ariaLabel, className }: RangeBarProps) {
  const position = markerPosition(zScore);
  return (
    <div role="img" aria-label={ariaLabel} className={cn("relative", className)}>
      <div className="flex h-4 items-center justify-between gap-px" aria-hidden>
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={cn("w-px bg-faint", tick === CENTRE_TICK ? "h-4" : "h-2")}
          />
        ))}
      </div>
      {position !== null && (
        <span
          className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${position * 100}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}
