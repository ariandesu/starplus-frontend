"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { Measurement } from "@starplus/core";
import { BodyMap, BodySystemList, BODY_SYSTEMS } from "@/components/body-map";
import { profileDb } from "@/lib/db";
import { useActiveCrew } from "@/lib/use-active-crew";
import { ContinueAsButtons } from "@/components/continue-as";

function BodyView() {
  const { crewId, ready: crewReady, candidates } = useActiveCrew();
  const [records, setRecords] = useState<Measurement[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!crewReady) return;
    (async () => {
      if (!crewId) {
        setReady(true);
        return;
      }
      try {
        const db = await profileDb(crewId);
        setRecords(await db.getAll("measurements"));
      } catch {
        setRecords([]);
      } finally {
        setReady(true);
      }
    })().catch(() => setReady(true));
  }, [crewId, crewReady]);

  const latestByCode = useMemo(() => {
    const latest = new Map<string, Measurement>();
    for (const record of records) {
      if (record.value_num === null || record.voided) continue;
      const current = latest.get(record.metric);
      if (!current || Date.parse(record.measured_at) >= Date.parse(current.measured_at)) {
        latest.set(record.metric, record);
      }
    }
    return latest;
  }, [records]);

  const codes = useMemo(() => new Set(latestByCode.keys()), [latestByCode]);
  const latest = useMemo(() => {
    return (code: string): string | null => {
      const record = latestByCode.get(code);
      if (!record || record.value_num === null) return null;
      return `${record.value_num} ${record.unit}`.trim();
    };
  }, [latestByCode]);

  if (!ready) return <p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>;
  if (!crewId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Log in to see the body map. <Link href="/login" className="text-accent underline">Go to login</Link>{" "}
          <Link href="/login?demo=astronaut" className="text-accent underline">Try the demo</Link>
        </p>
          <ContinueAsButtons candidates={candidates} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">Body map</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tap a region to see its latest readings. Grey regions have no data yet.</p>
      <BodyMap
        active={active}
        hasData={(systemId) => {
          const system = BODY_SYSTEMS.find((entry) => entry.id === systemId);
          return system ? [...system.measures].some((code) => codes.has(code)) : false;
        }}
        onSelect={(systemId) => setActive((current) => (current === systemId ? null : systemId))}
      />
      <BodySystemList systems={BODY_SYSTEMS} active={active} latest={latest} onSelect={(systemId) => setActive((current) => (current === systemId ? null : systemId))} />
    </div>
  );
}

export default function BodyPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <BodyView />
    </Suspense>
  );
}
