"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BentoItem {
  title: string;
  value: string | number;
  unit?: string;
  status?: "normal" | "watch" | "critical";
  trend?: "up" | "down" | "stable";
}

const BENTO_ITEMS: BentoItem[] = [
  { title: "Cabin Pressure", value: "14.7", unit: "psi", status: "normal", trend: "stable" },
  { title: "O2 Level", value: "20.9", unit: "%", status: "normal", trend: "stable" },
  { title: "CO2 Level", value: "0.5", unit: "mmHg", status: "watch", trend: "up" },
  { title: "Temperature", value: "22.1", unit: "°C", status: "normal", trend: "stable" },
  { title: "Radiation", value: "0.3", unit: "mSv/h", status: "normal", trend: "down" },
  { title: "Humidity", value: "45", unit: "%", status: "normal", trend: "stable" },
];

export function BentoGrid({ className }: { className?: string }) {
  return (
    <section className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto", className)}>
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Environmental Systems</h2>
        <p className="text-muted">Real-time telemetry from life-support modules.</p>
      </div>

      {/* Mobile-first: grid-flow-dense, single column below sm, bento on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 grid-flow-dense">
        {BENTO_ITEMS.map((item) => {
          const spanRow = item.title === "Cabin Pressure" ? 2 : 1;
          const spanCol = item.title === "O2 Level" ? 2 : 1;

          return (
            <Card
              key={item.title}
              className={cn(
                "p-4 sm:p-6 card-hover flex flex-col justify-between min-h-[200px] sm:min-h-[240px]",
                spanRow > 1 ? "lg:row-span-2" : "",
                spanCol > 1 ? "lg:col-span-2" : ""
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">{item.title}</CardTitle>
                  <Badge
                    variant={item.status === "normal" ? "default" : item.status === "watch" ? "outline" : "destructive"}
                  >
                    {item.status === "normal" ? "Nominal" : item.status === "watch" ? "WATCH" : "CRITICAL"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl sm:text-5xl font-bold text-foreground">{item.value}</span>
                  {item.unit && <span className="text-sm text-muted">{item.unit}</span>}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted">
                  <span>Trend: </span>
                  <span className={`font-medium ${item.trend === "up" ? "text-amber-600" : item.trend === "down" ? "text-emerald-600" : "text-muted"}`}>
                    {item.trend === "up" ? "▲ Rising" : item.trend === "down" ? "▼ Falling" : "→ Stable"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
