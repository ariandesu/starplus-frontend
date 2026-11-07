"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface InfiniteMarqueeProps {
  items: string[];
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
}

export function InfiniteMarquee({ items, className, speed = 40 }: InfiniteMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The list is rendered twice by React; moving by exactly half the track
    // width lands the second copy where the first started, so the loop is seamless.
    const tween = gsap.to(track, {
      xPercent: -50,
      duration: speed,
      repeat: -1,
      ease: "none",
    });
    return () => {
      tween.kill();
    };
  }, [speed]);

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
      <div ref={trackRef} className="flex w-max whitespace-nowrap">
        {row(0)}
        {row(1)}
      </div>
    </section>
  );
}
