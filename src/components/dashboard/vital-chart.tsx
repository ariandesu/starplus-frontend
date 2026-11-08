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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
              <XAxis dataKey="name" stroke="#71717A" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717A" fontSize={11} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip formatter={(value) => [`${value ?? "-"} ${unit}`, title]} />
              {hasBand && (
                <>
                  <Line type="monotone" dataKey="low" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey="high" stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1} dot={false} />
                </>
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0EA5E9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#0EA5E9" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
