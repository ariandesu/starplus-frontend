"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface VitalChartProps {
  title: string;
  data: Array<{ name: string; value: number; low?: number; high?: number }>;
  unit: string;
  baselineLabel?: string;
  /** A population reference band (never a status), drawn behind the readings with its source. */
  reference?: ChartReference;
  className?: string;
}

export interface ChartReference {
  low: number;
  high: number;
  /** Short name of the band, for example "Inspiration4 crew range". */
  label: string;
  /** How the band was computed, for example "mean ± 1 SD of 24 samples". */
  detail: string;
  sourceName: string;
  sourceUrl: string;
}

export function VitalChart({ title, data, unit, baselineLabel, reference, className }: VitalChartProps) {
  const hasBand = data.some((point) => point.low !== undefined && point.high !== undefined);
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">
          {title} <span className="font-normal text-muted">({unit})</span>
        </CardTitle>
        {baselineLabel && <p className="text-xs text-muted-foreground">{baselineLabel}</p>}
        {reference && (
          <p data-testid="chart-reference" className="flex items-start gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-block h-3 w-4 shrink-0 rounded-sm border"
              style={{ background: "var(--deco-band)", borderColor: "var(--deco-line)" }}
            />
            <span>
              Shaded band: {reference.label}, {reference.low}–{reference.high} {unit} ({reference.detail}),
              from{" "}
              <a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {reference.sourceName}
              </a>
              . A comparison only; it does not change your status.
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                stroke="var(--muted)"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                stroke="var(--muted)"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickLine={false}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(value) => [`${value ?? "-"} ${unit}`, title]}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                }}
              />
              {reference && (
                <ReferenceArea
                  y1={reference.low}
                  y2={reference.high}
                  ifOverflow="extendDomain"
                  fill="var(--deco-band)"
                  fillOpacity={1}
                  stroke="var(--deco-line)"
                  strokeDasharray="2 3"
                />
              )}
              {hasBand && (
                <>
                  <Line type="monotone" dataKey="low" stroke="var(--faint)" strokeDasharray="4 4" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="high" stroke="var(--faint)" strokeDasharray="4 4" strokeWidth={1} dot={false} />
                </>
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--foreground)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--foreground)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
