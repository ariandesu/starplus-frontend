"use client";

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface InfiniteMarqueeProps {
  items: string[];
  className?: string;
  speed?: number;
}

export function InfiniteMarquee({
  items,
  className,
  speed = 50,
}: InfiniteMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const el = containerRef.current;
    if (!el) return;

    const track = el.querySelector(".marquee-track") as HTMLElement;
    if (!track) return;

    // Duplicate content for seamless loop
    track.innerHTML = track.innerHTML + track.innerHTML;

    let animation: gsap.core.Tween | null = null;

    const animate = () => {
      const trackWidth = track.scrollWidth / 2; // original width before duplication
      animation = gsap.to(track, {
        x: -trackWidth,
        duration: speed,
        repeat: -1,
        ease: "none",
      });
    };

    animate();

    return () => {
      if (animation) animation.kill();
    };
  }, [speed]);

  return (
    <section
      ref={containerRef}
      className={cn(
        "overflow-hidden relative bg-accent py-6 px-4 sm:px-8",
        className
      )}
    >
      <div className="absolute inset-0 bg-accent/20 blur-[100px]" />
      <div className="relative z-10">
        <div className="flex items-center gap-8 whitespace-nowrap marquee-track">
          {items.map((item, i) => (
            <span key={i} className="text-accent-foreground font-semibold text-sm sm:text-base tracking-widest uppercase opacity-80">
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
