"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { HAZARD_SECTIONS, measuresForHazard } from "@/lib/hazards";
import { citeLabel, getKbEntry } from "@/lib/kb";
import { useActiveCrew } from "@/lib/use-active-crew";
import { useHealthSummary } from "@/lib/use-health-summary";

function HazardsView() {
  const session = useActiveCrew();
  const crewId = session.status === "active" ? session.crewId : null;
  const summary = useHealthSummary(crewId);
  const statusByMetric = new Map(summary.entries.map((entry) => [entry.metric, entry.status]));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="text-[1.75rem] font-bold tracking-tight">Hazards</h1>
      <p className="mt-1 text-sm text-muted">
        The five hazards of a long space mission, and what this app tracks for each one. Your
        latest status shows when you are signed in. This page works offline.
      </p>
      <div className="mt-4 space-y-4">
        {HAZARD_SECTIONS.map((section) => {
          const entry = getKbEntry(section.kbKey);
          if (!entry) return null;
          const measures = measuresForHazard(section.tag);
          return (
            <section key={section.key} aria-label={entry.title}>
              <Card>
                <CardHeader title={entry.title} />
                <CardContent>
                  {entry.text.map((paragraph) => (
                    <p key={paragraph.slice(0, 24)} className="mt-2 text-sm text-foreground first:mt-0">
                      {paragraph}
                    </p>
                  ))}
                  <h3 className="mt-4 text-sm font-semibold">Tracked in this app</h3>
                  <ul className="mt-2 space-y-2">
                    {measures.map((measure) => {
                      const status = statusByMetric.get(measure.code);
                      return (
                        <li
                          key={measure.code}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-tile bg-surface px-3 py-2"
                        >
                          <span className="text-sm">
                            {measure.label}
                            {measure.unit ? (
                              <span className="text-muted"> ({measure.unit})</span>
                            ) : null}
                          </span>
                          {status ? (
                            <StatusPill status={status} />
                          ) : (
                            <span className="text-xs text-muted">No readings yet</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-sm">
                    <Link className="underline" href="/check">
                      Record a reading
                    </Link>
                  </p>
                  {entry.citations.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {entry.citations.map((citation) => (
                        <li key={citation.url}>
                          Source: {citeLabel(citation)} —{" "}
                          <a
                            className="underline"
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {citation.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function HazardsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading hazards…</p>}>
      <HazardsView />
    </Suspense>
  );
}
