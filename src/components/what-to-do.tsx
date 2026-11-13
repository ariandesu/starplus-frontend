"use client";

import Link from "next/link";
import type { CatalogMeasure, KbEntry } from "@starplus/core";
import { adviceSentence, hazardLinks, measureSide } from "@/lib/result-advice";

const LOW_GLUCOSE_SCENARIO = "/emergency?scenario=low-blood-sugar";
const MEDICINE_WARNING = "Ask the crew medical officer before taking any medicine.";

/** "What to do" for a watch or critical measure. All wording comes from the cited KB. */
export function WhatToDo({
  status,
  value,
  measure,
  kb,
}: {
  status: string;
  value: number | string | null;
  measure: CatalogMeasure | undefined;
  kb: KbEntry | null;
}) {
  if (status !== "watch" && status !== "critical") return null;
  const side = measureSide(measure, value);
  const isLowGlucose = measure?.code === "blood_glucose" && side === "low";
  const isHighTemp = measure?.code === "temperature_c" && side === "high";
  const line3Href =
    status === "critical" ? (isLowGlucose ? LOW_GLUCOSE_SCENARIO : "/emergency") : null;
  const treatment =
    isHighTemp
      ? { href: "/medicines#acetaminophen", kind: "medicine" as const }
      : isLowGlucose
        ? { href: LOW_GLUCOSE_SCENARIO, kind: "firstaid" as const }
        : null;
  const showTreatmentLink =
    treatment?.kind === "firstaid" && treatment.href !== line3Href;
  return (
    <div className="mt-2 rounded-lg bg-surface p-3 text-sm">
      <h3 className="font-semibold text-foreground">What to do</h3>
      <p className="mt-1 text-foreground">{adviceSentence(kb)}</p>
      {hazardLinks(measure).map((hazard) => (
        <p key={hazard.href} className="mt-1 text-foreground">
          Related hazard:{" "}
          <Link className="underline" href={hazard.href}>
            {hazard.name}
          </Link>
        </p>
      ))}
      {line3Href && (
        <p className="mt-1">
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-danger underline"
            href={line3Href}
          >
            Open Emergency
          </Link>
        </p>
      )}
      {isHighTemp && treatment && (
        <p className="mt-1 text-foreground">
          Related onboard medicine:{" "}
          <Link className="underline" href={treatment.href}>
            Acetaminophen (paracetamol)
          </Link>
        </p>
      )}
      {showTreatmentLink && treatment && (
        <p className="mt-1">
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-danger underline"
            href={treatment.href}
          >
            Open Emergency
          </Link>
        </p>
      )}
      {(isHighTemp || isLowGlucose) && (
        <p className="mt-1 text-xs text-muted-foreground">{MEDICINE_WARNING}</p>
      )}
    </div>
  );
}
