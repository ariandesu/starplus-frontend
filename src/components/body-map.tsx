"use client";

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

export function systemHasData(system: BodySystem, codes: ReadonlySet<string>): boolean {
  return system.measures.some((code) => codes.has(code));
}

export function BodyMap({
  active,
  hasData,
  onSelect,
}: {
  active: string | null;
  hasData: (systemId: string) => boolean;
  onSelect: (systemId: string) => void;
}) {
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label="Body map" className="mx-auto h-64">
      <circle cx="100" cy="40" r="22" fill={hasData("mind") ? "#f59e0b" : "#e5e7eb"} data-system="mind" onClick={() => onSelect("mind")} style={{ cursor: "pointer" }}>
        <title>Head: sleep and mind</title>
      </circle>
      <g onClick={() => onSelect("cardio")} style={{ cursor: "pointer" }}>
        <title>Chest: heart and circulation</title>
        <rect x="78" y="62" width="44" height="34" rx="10" fill={hasData("cardio") ? "#ef4444" : "#e5e7eb"} data-system="cardio" />
      </g>
      <g onClick={() => onSelect("lungs")} style={{ cursor: "pointer" }}>
        <title>Lungs and breathing</title>
        <rect x="70" y="100" width="60" height="30" rx="10" fill={hasData("lungs") ? "#38bdf8" : "#e5e7eb"} data-system="lungs" />
      </g>
      <g onClick={() => onSelect("fuel")} style={{ cursor: "pointer" }}>
        <title>Belly: fuel and fluids</title>
        <rect x="78" y="134" width="44" height="36" rx="10" fill={hasData("fuel") ? "#22c55e" : "#e5e7eb"} data-system="fuel" />
      </g>
      <rect x="88" y="174" width="10" height="34" rx="5" fill="#e5e7eb" />
      <rect x="102" y="174" width="10" height="34" rx="5" fill="#e5e7eb" />
      {active !== null && <rect x="4" y="4" width="192" height="212" rx="12" fill="none" stroke="#111827" strokeWidth="2" strokeDasharray="6 4" />}
    </svg>
  );
}

export function BodySystemList({
  systems,
  active,
  latest,
  onSelect,
}: {
  systems: BodySystem[];
  active: string | null;
  latest: (code: string) => string | null;
  onSelect: (systemId: string) => void;
}) {
  return (
    <ul className="mt-4 space-y-2">
      {systems.map((system) => {
        const values = system.measures
          .map((code) => ({ code, value: latest(code) }))
          .filter((entry) => entry.value !== null);
        const selected = active === system.id;
        return (
          <li key={system.id}>
            <button
              type="button"
              onClick={() => onSelect(system.id)}
              aria-pressed={selected}
              className={`w-full rounded-xl border px-4 py-3 text-left ${selected ? "border-foreground" : "border-border"}`}
            >
              <span className="font-semibold text-foreground">{system.label}</span>
              {values.length === 0 ? (
                <span className="mt-1 block text-sm text-muted-foreground">No data yet.</span>
              ) : (
                <span className="mt-1 block text-sm text-muted-foreground">
                  {values.map((entry) => `${entry.code}: ${entry.value}`).join(" · ")}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
