"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { lookupMeasure, type Measurement } from "@starplus/core";
import { BODY_SYSTEMS, BodySystemList } from "@/components/body-map";
import { BodyViewer } from "@/components/body/body-viewer";
import { MetricTile } from "@/components/dashboard/metric-tile";
import { PageHeader } from "@/components/dashboard/page-header";
import { RequireSession } from "@/components/require-session";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { bodyModel, setBodyModel, type BodyModel } from "@/lib/body-model-settings";
import { systemStatus } from "@/lib/health-summary";
import { shortDate } from "@/lib/report-title";
import { useActiveCrew } from "@/lib/use-active-crew";
import { useHealthSummary } from "@/lib/use-health-summary";

function BodyView() {
  const session = useActiveCrew();
  const { crewId } = session;
  const summary = useHealthSummary(crewId);
  const [active, setActive] = useState<string | null>(null);
  const [model, setModelState] = useState<BodyModel>(() => bodyModel());

  const latestByCode = useMemo(() => {
    const latest = new Map<string, Measurement>();
    for (const record of summary.measurements) {
      if (record.value_num === null || record.voided) continue;
      const current = latest.get(record.metric);
      if (!current || Date.parse(record.measured_at) >= Date.parse(current.measured_at)) {
        latest.set(record.metric, record);
      }
    }
    return latest;
  }, [summary.measurements]);

  const latest = useMemo(() => {
    return (code: string): string | null => {
      const record = latestByCode.get(code);
      if (!record || record.value_num === null) return null;
      return `${record.value_num} ${record.unit}`.trim();
    };
  }, [latestByCode]);

  const statusFor = useMemo(() => {
    return (systemId: string): string | null => {
      const system = BODY_SYSTEMS.find((entry) => entry.id === systemId);
      return system ? systemStatus(system, summary.entries) : null;
    };
  }, [summary.entries]);

  const systems = useMemo(
    () =>
      BODY_SYSTEMS.map((system) => ({
        id: system.id,
        label: system.label,
        status: systemStatus(system, summary.entries),
      })),
    [summary.entries]
  );

  function select(systemId: string) {
    setActive((current) => (current === systemId ? null : systemId));
  }

  function changeModel(value: string) {
    const next: BodyModel = value === "male" ? "male" : "female";
    setModelState(next);
    setBodyModel(next);
  }

  if (!summary.ready) {
    return <p className="px-4 py-8 text-sm text-muted">Loading…</p>;
  }
  if (session.status !== "active" || !crewId) {
    return <RequireSession session={session} heading="Body map" />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader eyebrow="BODY" title="Body map" />
      <p className="mt-1 text-sm text-muted">
        Drag to rotate. Choose a marker or a system to see its latest readings. Grey means no data yet.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card
            className="relative h-[60vh] max-h-[420px] overflow-hidden p-0 lg:h-[600px] lg:max-h-none"
            style={{ background: "radial-gradient(120% 100% at 50% 30%, var(--card), var(--surface))" }}
          >
            <div className="absolute right-3 top-3 z-10">
              <SegmentedControl
                ariaLabel="Model"
                value={model}
                onChange={changeModel}
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
              />
            </div>
            <BodyViewer
              model={model}
              systems={systems}
              active={active}
              onSelect={select}
              statusFor={statusFor}
            />
          </Card>
          <p className="mt-2 text-xs text-muted">
            3D people:{" "}
            <Link
              href="https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f"
              target="_blank"
              rel="noreferrer"
              className="underline text-accent-strong focus-ring"
            >
              Eric Rigged 001
            </Link>{" "}
            and{" "}
            <Link
              href="https://sketchfab.com/3d-models/claudia-rigged-002-3d-rigged-business-women-c659bd0accab47c6bbe390cf822a2b92"
              target="_blank"
              rel="noreferrer"
              className="underline text-accent-strong focus-ring"
            >
              Claudia Rigged 002
            </Link>{" "}
            by Renderpeople,{" "}
            <Link
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
              className="underline text-accent-strong focus-ring"
            >
              CC BY 4.0
            </Link>
            , modified.
          </p>
        </div>
        <div className="lg:col-span-5">
          <BodySystemList
            systems={BODY_SYSTEMS}
            active={active}
            latest={latest}
            statusFor={statusFor}
            onSelect={select}
            renderTiles={(systemId) => {
              const system = BODY_SYSTEMS.find((entry) => entry.id === systemId);
              if (!system) return null;
              const tiles = summary.entries.filter((entry) => system.measures.includes(entry.metric));
              if (tiles.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
              return (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {tiles.map((entry) => {
                    const measure = lookupMeasure(entry.metric);
                    const baseline = entry.values.baseline_mean;
                    return (
                      <MetricTile
                        key={entry.metric}
                        eyebrow={measure ? measure.body_system.replace(/_/g, " ") : ""}
                        label={measure?.label ?? entry.metric}
                        value={entry.values.value === null ? "—" : String(entry.values.value)}
                        unit={entry.values.unit}
                        status={entry.status}
                        zScore={entry.values.z_score}
                        baselineText={
                          baseline === null
                            ? "No baseline yet"
                            : `Baseline ${baseline.toFixed(1)} ${entry.values.unit}`
                        }
                        dateText={shortDate(entry.assessed_at)}
                      />
                    );
                  })}
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function BodyPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading…</p>}>
      <BodyView />
    </Suspense>
  );
}
