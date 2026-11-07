"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InfiniteMarqueeProps {
  items: string[];
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
}

export function InfiniteMarquee({ items, className, speed = 40 }: InfiniteMarqueeProps) {
  const row = (copy: number) =>
    items.map((item, i) => (
      <span
        key={`${copy}-${i}`}
        aria-hidden={copy > 0}
        className="pr-10 text-accent-foreground font-semibold text-sm tracking-widest uppercase"
      >
        {item}
      </span>
    ));

  return (
    <section className={cn("overflow-hidden bg-accent py-5 mt-8", className)}>
      <div
        className="flex w-max whitespace-nowrap motion-safe:animate-[marquee_var(--marquee-duration,40s)_linear_infinite] motion-reduce:animate-none"
        style={{ ["--marquee-duration" as string]: `${speed}s` }}
      >
        {row(0)}
        {row(1)}
      </div>
      <style>{`@keyframes marquee { to { transform: translateX(-50%); } }`}</style>
    </section>
  );
}
