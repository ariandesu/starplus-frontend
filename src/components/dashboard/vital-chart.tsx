"use client";

import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface VitalChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  unit: string;
  className?: string;
}

export function VitalChart({ title, data, unit, className }: VitalChartProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#71717A" fontSize="10" />
              <YAxis stroke="#71717A" fontSize="10" />
              <Tooltip formatter={(value: any) => `${value ?? 0} ${unit}`} />
              <Legend />
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

interface VitalsGridProps {
  className?: string;
}

export function VitalsGrid({ className }: VitalsGridProps) {
  const vitalsData = [
    { name: "00:00", value: 72 },
    { name: "00:15", value: 75 },
    { name: "00:30", value: 78 },
    { name: "00:45", value: 74 },
    { name: "01:00", value: 76 },
    { name: "01:15", value: 73 },
    { name: "01:30", value: 75 },
    { name: "01:45", value: 77 },
  ];

  const spo2Data = [
    { name: "00:00", value: 98 },
    { name: "00:15", value: 97 },
    { name: "00:30", value: 98 },
    { name: "00:45", value: 99 },
    { name: "01:00", value: 98 },
    { name: "01:15", value: 97 },
    { name: "01:30", value: 98 },
    { name: "01:45", value: 99 },
  ];

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)}>
      <VitalChart title="Heart Rate" data={vitalsData} unit="bpm" />
      <VitalChart title="SpO2" data={spo2Data} unit="%" />
    </div>
  );
}
