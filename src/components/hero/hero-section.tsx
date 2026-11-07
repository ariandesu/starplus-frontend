"use client";

import * as React from "react";
import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeartPulse, Wifi, Activity, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface HeroSectionProps {
  className?: string;
}

const VITALS = [
  { label: "Heart Rate", value: "72", unit: "bpm", status: "normal", icon: HeartPulse },
  { label: "SpO2", value: "98", unit: "%", status: "normal", icon: Wifi },
  { label: "ECG", value: "60", unit: "bpm", status: "watch", icon: Activity },
  { label: "Mission Time", value: "14:32:11", unit: "", status: "active", icon: Clock },
];

export function HeroSection({ className }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    gsap.from(containerRef.current, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top bottom-=100",
        toggleActions: "play none none reverse",
      },
      opacity: 0,
      y: 30,
      duration: 0.8,
      ease: "power2.out",
    });
  }, []);

  return (
    <section
      ref={containerRef}
      className={cn("px-4 py-8 sm:px-6 lg:px-8 max-w-6xl mx-auto", className)}
    >
      <div className="mb-10">
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight text-foreground mb-4">
          STAR PLUS
        </h1>
        <p className="text-lg sm:text-xl text-muted max-w-2xl leading-relaxed">
          Real-time astronaut health monitoring, WATCH signal detection, and mission-critical telemetry for deep-space operations.
        </p>
      </div>

      {/* Cinematic Center Hero Grid - mobile first single column */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
        {VITALS.map((vital) => {
          const Icon = vital.icon;
          return (
            <Card key={vital.label} className="card-hover p-4 sm:p-6">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted">{vital.label}</p>
                    <p className="text-xl font-semibold text-foreground">{vital.value}</p>
                    {vital.unit && <span className="text-xs text-muted ml-1">{vital.unit}</span>}
                  </div>
                  <div className="p-2 rounded-lg bg-accent/10 text-accent">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <Badge variant={vital.status === "normal" ? "default" : "outline"}>
                  {vital.status === "normal" ? "Nominal" : "WATCH"}
                </Badge>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* GSAP Card Stacking - scroll pinning */}
      <div className="relative card-stack">
        <div className="flex flex-col sm:flex-row gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="card-hover h-64 sm:h-80 relative overflow-hidden"
              style={{ zIndex: 4 - i, transform: `translateX(${i * 4}%)` }}
            >
              <CardHeader className="absolute top-4 left-4 right-4">
                <CardTitle className="text-lg sm:text-xl">Crew Status #{i}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-col justify-center h-full">
                  <p className="text-muted text-center">Telemetry data streaming from module {i}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
