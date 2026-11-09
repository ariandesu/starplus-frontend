"use client";

import Link from "next/link";
import { StatusTone } from "@/components/citation";
import type { RosterRow } from "@/lib/api";
import { shortDate } from "@/lib/report-title";

export function timeAgo(iso: string | null): string {
  if (!iso) return "no check-in yet";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 60) return `last check-in ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `last check-in ${hours} h ago`;
  return `last check-in ${shortDate(iso)}`;
}

const VITAL_LABELS: Record<string, string> = {
  heart_rate: "Heart rate",
  blood_pressure_systolic: "Systolic",
  blood_pressure_diastolic: "Diastolic",
  oxygen_saturation: "SpO2",
  temperature_c: "Temp",
  blood_glucose: "Glucose",
  respiratory_rate: "Resp rate",
};

function vitalLabel(metric: string): string {
  return VITAL_LABELS[metric] ?? metric;
}

function CrewCard({ row }: { row: RosterRow }) {
  return (
    <Link
      href={`/surgeon/crew?id=${encodeURIComponent(row.crew_id)}`}
      className="block rounded-xl border border-border p-4 transition-colors hover:bg-accent/10 focus-ring"
      data-testid={`crew-card-${row.crew_id}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{row.name}</p>
        <StatusTone status={row.overall_status ?? "insufficient"} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {row.overall_status ?? "no data yet"} · {timeAgo(row.last_check_in)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {row.checkin_days_7d} check-in {row.checkin_days_7d === 1 ? "day" : "days"} in the last 7
        {row.open_reports > 0 && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            {row.open_reports} open {row.open_reports === 1 ? "report" : "reports"}
          </span>
        )}
      </p>
      {row.vitals.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {row.vitals.slice(0, 6).map((vital) => (
            <div key={vital.metric} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{vitalLabel(vital.metric)}</dt>
              <dd className="font-medium text-foreground">
                {String(vital.value)} {vital.unit} · {vital.status}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}

export function CrewBoard({ rows, updatedAt }: { rows: RosterRow[]; updatedAt: string | null }) {
  return (
    <section aria-label="Crew board" className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Crew</h2>
        {updatedAt && <p className="text-xs text-muted-foreground">Last updated {updatedAt}</p>}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No crew on this device yet.</p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <CrewCard key={row.crew_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
