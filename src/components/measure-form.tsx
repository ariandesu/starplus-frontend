"use client";

import { useState } from "react";
import type { CatalogMeasure } from "@starplus/core";

export interface MeasureDraft {
  metric: string;
  value: number;
  unit: string;
  source: "manual";
  confidence: number;
  capture_id?: string;
  howto: string;
  why: string;
}

export function MeasureForm({
  measure,
  howto,
  why,
  onSubmit,
}: {
  measure: CatalogMeasure;
  howto: string;
  why: string;
  onSubmit: (draft: MeasureDraft) => void;
}) {
  const [value, setValue] = useState("");
  const [estimated, setEstimated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setError("Enter a number.");
      return;
    }
    setError(null);
    onSubmit({
      metric: measure.code,
      value: parsed,
      unit: measure.unit,
      source: "manual",
      confidence: estimated ? 0.4 : 1,
      howto,
      why,
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border p-4">
      <label htmlFor={`measure-${measure.code}`} className="text-sm font-semibold text-foreground">
        {measure.label} ({measure.unit || "score"})
      </label>
      <p className="mt-1 text-sm text-muted-foreground">How: {howto}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">Why: {why}</p>
      <input
        id={`measure-${measure.code}`}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
        aria-describedby={`measure-${measure.code}-hint`}
      />
      <p id={`measure-${measure.code}-hint`} className="mt-1 text-xs text-muted">
        Plausible range {measure.bounds.min}–{measure.bounds.max} {measure.unit}.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={estimated} onChange={(event) => setEstimated(event.target.checked)} />
        Estimated, no device
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Record
      </button>
    </form>
  );
}
