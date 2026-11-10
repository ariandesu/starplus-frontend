"use client";

import * as React from "react";
import Link from "next/link";
import { BODY_SYSTEMS } from "@/components/body-map";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { systemStatus, type MeasureEntry } from "@/lib/health-summary";

export function SystemsCard({ entries }: { entries: MeasureEntry[] }) {
  return (
    <Card className="h-full p-5 lg:p-6">
      <CardHeader
        className="p-0"
        title="Body systems"
        action={
          <Link href="/body" className="text-sm font-medium text-accent-strong underline underline-offset-4">
            Open body map
          </Link>
        }
      />
      <ul className="mt-2">
        {BODY_SYSTEMS.map((system) => {
          const status = systemStatus(system, entries);
          return (
            <li
              key={system.id}
              className="flex min-h-11 items-center justify-between gap-3 border-b border-border py-2 last:border-0"
            >
              <span className="text-sm text-foreground">{system.label}</span>
              {status ? <StatusPill status={status} /> : <span className="text-sm text-muted">No data yet</span>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
