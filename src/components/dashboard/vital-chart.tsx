"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface VitalChartProps {
  title: string;
  data: Array<{ name: string; value: number; low?: number; high?: number }>;
  unit: string;
  baselineLabel?: string;
  className?: string;
}

export function VitalChart({ title, data, unit, baselineLabel, className }: VitalChartProps) {
  const hasBand = data.some((point) => point.low !== undefined && point.high !== undefined);
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">
          {title} <span className="font-normal text-muted">({unit})</span>
        </CardTitle>
        {baselineLabel && <p className="text-xs text-muted-foreground">{baselineLabel}</p>}
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
