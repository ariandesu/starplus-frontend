"use client";

import { Suspense } from "react";
import formulary from "@starplus/core/content/formulary.json" with { type: "json" };
import type { FormularyEntry } from "@starplus/core";
import { MedicineExplainer } from "@/components/medicine-explainer";
import { useActiveCrew } from "@/lib/use-active-crew";

const entries = (formulary as { entries: FormularyEntry[] }).entries;

function MedicinesView() {
  const session = useActiveCrew();
  const crewId = session.status === "active" ? session.crewId : null;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Medicines</h1>
      <p className="text-sm text-muted">
        Onboard formulary. Doses follow the flight surgeon or mission protocol unless a quoted
        source states otherwise. This list works offline.
      </p>
      <ul className="space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-tile border border-border bg-card p-4 shadow-card">
            <h2 className="text-lg font-semibold">{entry.name}</h2>
            <p className="mt-1 text-sm text-foreground">{entry.purpose}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="inline font-medium">Side effects: </dt>
                <dd className="inline text-foreground">{entry.side_effects}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Interactions: </dt>
                <dd className="inline text-foreground">{entry.interactions}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Dose: </dt>
                <dd className="inline text-foreground">{entry.dose}</dd>
              </div>
            </dl>
            {entry.citations.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {entry.citations.map((citation) => (
                  <li key={citation.url}>
                    Source: {citation.publisher}, {citation.year} —{" "}
                    <a className="underline" href={citation.url} target="_blank" rel="noreferrer">
                      {citation.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {crewId && <MedicineExplainer crewId={crewId} medicineId={entry.id} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MedicinesPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading medicines…</p>}>
      <MedicinesView />
    </Suspense>
  );
}
