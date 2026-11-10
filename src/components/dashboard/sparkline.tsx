"use client";

import * as React from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  ariaLabel: string;
  className?: string;
}

export function Sparkline({ data, ariaLabel, className }: SparklineProps) {
  if (data.length < 2) return null;
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div role="img" aria-label={ariaLabel} className={cn("h-10 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--foreground)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
