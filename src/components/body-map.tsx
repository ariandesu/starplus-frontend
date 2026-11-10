"use client";

import * as React from "react";
import { lookupMeasure } from "@starplus/core";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/ui/status-pill";

export interface BodySystem {
  id: string;
  label: string;
  measures: string[];
}

export const BODY_SYSTEMS: BodySystem[] = [
  { id: "mind", label: "Sleep and mind", measures: ["sleep_hours", "sleep_quality", "mood_score", "stress_score", "reaction_time"] },
  { id: "cardio", label: "Heart and circulation", measures: ["heart_rate", "blood_pressure_systolic", "blood_pressure_diastolic", "hrv_rmssd"] },
  { id: "lungs", label: "Lungs and breathing", measures: ["respiratory_rate", "oxygen_saturation"] },
  { id: "fuel", label: "Fuel and fluids", measures: ["blood_glucose", "body_mass", "water_intake", "calories", "physical_activity", "urine_specific_gravity"] },
  { id: "whole", label: "Whole body", measures: ["temperature_c", "radiation_dose"] },
];

const REGION_FILL: Record<string, string> = {
  nominal: "fill-status-nominal-dot",
  watch: "fill-status-watch-dot",
  critical: "fill-status-critical-dot",
  insufficient: "fill-status-insufficient-dot",
};

function fillFor(status: string | null): string {
  return status ? (REGION_FILL[status] ?? "fill-surface-2") : "fill-surface-2";
}

export function systemHasData(system: BodySystem, codes: ReadonlySet<string>): boolean {
  return system.measures.some((code) => codes.has(code));
}

export function BodyMap({
  active,
  statusFor,
  onSelect,
}: {
  active: string | null;
  statusFor: (systemId: string) => string | null;
  onSelect: (systemId: string) => void;
}) {
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label="Body map" className="mx-auto h-full max-h-[520px]">
      <circle
        cx="100"
        cy="40"
        r="22"
        className={cn(fillFor(statusFor("mind")), "cursor-pointer")}
        data-system="mind"
        onClick={() => onSelect("mind")}
      >
        <title>Head: sleep and mind</title>
      </circle>
      <g onClick={() => onSelect("cardio")} className="cursor-pointer">
        <title>Chest: heart and circulation</title>
        <rect x="78" y="62" width="44" height="34" rx="10" className={fillFor(statusFor("cardio"))} data-system="cardio" />
      </g>
      <g onClick={() => onSelect("lungs")} className="cursor-pointer">
        <title>Lungs and breathing</title>
        <rect x="70" y="100" width="60" height="30" rx="10" className={fillFor(statusFor("lungs"))} />
      </g>
      <g onClick={() => onSelect("fuel")} className="cursor-pointer">
        <title>Belly: fuel and fluids</title>
        <rect x="78" y="134" width="44" height="36" rx="10" className={fillFor(statusFor("fuel"))} />
      </g>
      <rect x="88" y="174" width="10" height="34" rx="5" className="fill-surface-2" />
      <rect x="102" y="174" width="10" height="34" rx="5" className="fill-surface-2" />
      {active !== null && (
        <rect x="4" y="4" width="192" height="212" rx="12" className="fill-none stroke-foreground" strokeWidth="2" strokeDasharray="6 4" />
      )}
    </svg>
  );
}

export function BodySystemList({
  systems,
  active,
  latest,
  statusFor,
  renderTiles,
  onSelect,
}: {
  systems: BodySystem[];
  active: string | null;
  latest: (code: string) => string | null;
  statusFor: (systemId: string) => string | null;
  renderTiles?: (systemId: string) => React.ReactNode;
  onSelect: (systemId: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {systems.map((system) => {
        const values = system.measures
          .map((code) => ({ code, label: lookupMeasure(code)?.label ?? code, value: latest(code) }))
          .filter((entry) => entry.value !== null);
        const status = statusFor(system.id);
        const selected = active === system.id;
        return (
          <li key={system.id}>
            <div className={cn("rounded-tile border bg-card", selected ? "border-foreground" : "border-border")}>
              <button
                type="button"
                onClick={() => onSelect(system.id)}
                aria-pressed={selected}
                className="min-h-11 w-full px-4 py-3 text-left"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{system.label}</span>
                  {status ? (
                    <StatusPill status={status} />
                  ) : (
                    <span className="text-sm text-muted">No data yet.</span>
                  )}
                </span>
                {values.length > 0 && (
                  <span className="mt-1 block text-sm text-muted">
                    {values.map((entry) => `${entry.label}: ${entry.value}`).join(" · ")}
                  </span>
                )}
              </button>
              {selected && renderTiles && (
                <div className="border-t border-border p-3">{renderTiles(system.id)}</div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
