"use client";

import { lookupMeasure } from "@starplus/core";
import { previewReady, type EditableReading } from "@/lib/adapters/voice";

export const METRIC_OPTIONS = [
  "heart_rate",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "oxygen_saturation",
  "temperature_c",
  "blood_glucose",
  "body_mass",
  "respiratory_rate",
];

export function ReadingPreview({
  readings,
  onChange,
  onSave,
  busy,
}: {
  readings: EditableReading[];
  onChange: (index: number, patch: Partial<EditableReading>) => void;
  onSave: (event: React.FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form
      onSubmit={onSave}
      className="mt-4 space-y-3"
    >
      <h2 className="text-base font-semibold text-foreground">Preview</h2>
      {readings.map((reading, index) => (
        <div key={index} className="grid grid-cols-3 gap-2">
          <select
            aria-label="Metric"
            value={reading.metric}
            onChange={(event) => {
              const metric = event.target.value;
              onChange(index, {
                metric,
                unit: metric ? (lookupMeasure(metric)?.unit ?? reading.unit) : reading.unit,
              });
            }}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          >
            <option value="">Choose a measure</option>
            {METRIC_OPTIONS.map((metric) => (
              <option key={metric} value={metric}>
                {metric}
              </option>
            ))}
          </select>
          <input
            aria-label="Value"
            inputMode="decimal"
            value={reading.value}
            onChange={(event) => onChange(index, { value: event.target.value })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
          <input
            aria-label="Unit"
            value={reading.unit}
            onChange={(event) => onChange(index, { unit: event.target.value })}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </div>
      ))}
      <button
        type="submit"
        data-testid="save"
        disabled={busy || !previewReady(readings)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Save result
      </button>
    </form>
  );
}
