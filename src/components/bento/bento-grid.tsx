import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoBadge } from "@/components/dashboard/demo-badge";

interface BentoItem {
  title: string;
  value: string;
  unit?: string;
  status: "normal" | "watch" | "critical";
  trend: "up" | "down" | "stable";
  span?: "wide" | "tall";
}

// The backend has no environmental telemetry table yet, so this section is
// always sample data and is labelled as such.
const BENTO_ITEMS: BentoItem[] = [
  { title: "Cabin Pressure", value: "14.7", unit: "psi", status: "normal", trend: "stable", span: "tall" },
  { title: "O2 Level", value: "20.9", unit: "%", status: "normal", trend: "stable", span: "wide" },
  { title: "CO2 Level", value: "3.1", unit: "mmHg", status: "watch", trend: "up" },
  { title: "Temperature", value: "22.1", unit: "°C", status: "normal", trend: "stable" },
  { title: "Radiation", value: "0.3", unit: "mSv/day", status: "normal", trend: "down" },
  { title: "Humidity", value: "45", unit: "%", status: "normal", trend: "stable" },
];

export function BentoGrid({ className }: { className?: string }) {
  return (
    <section id="environment" className={cn("px-4 py-8 sm:px-6 max-w-6xl mx-auto w-full", className)}>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Environmental Systems</h2>
          <DemoBadge />
        </div>
        <p className="text-muted">Life-support telemetry. Not connected to a live source yet.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 grid-flow-dense">
        {BENTO_ITEMS.map((item) => (
          <Card
            key={item.title}
            className={cn(
              "p-5 sm:p-6 card-hover flex flex-col justify-between gap-6 min-h-[160px]",
              item.span === "tall" && "lg:row-span-2",
              item.span === "wide" && "sm:col-span-2"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">{item.title}</h3>
              <Badge
                variant={item.status === "normal" ? "secondary" : item.status === "watch" ? "outline" : "destructive"}
              >
                {item.status === "normal" ? "Nominal" : item.status === "watch" ? "WATCH" : "CRITICAL"}
              </Badge>
            </div>
            <div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums">{item.value}</span>
                {item.unit && <span className="text-sm text-muted">{item.unit}</span>}
              </div>
              <p className="text-sm text-muted">
                Trend:{" "}
                <span
                  className={cn(
                    "font-medium",
                    item.trend === "up" ? "text-amber-700" : item.trend === "down" ? "text-emerald-700" : "text-muted"
                  )}
                >
                  {item.trend === "up" ? "Rising" : item.trend === "down" ? "Falling" : "Stable"}
                </span>
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
