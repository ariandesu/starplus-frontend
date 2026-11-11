"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/status-pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { RosterRow } from "@/lib/api";
import { shortDate } from "@/lib/report-title";
import { sortVitals } from "@/lib/vital-order";

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
  respiratory_rate: "Resp rate",
  hrv_rmssd: "HRV",
};

const STATUS_DOT: Record<string, string> = {
  nominal: "bg-status-nominal-dot",
  watch: "bg-status-watch-dot",
  critical: "bg-status-critical-dot",
  insufficient: "bg-status-insufficient-dot",
};

function vitalLabel(metric: string): string {
  return VITAL_LABELS[metric] ?? metric;
}

function statusDot(status: string): string {
  return STATUS_DOT[status] ?? STATUS_DOT.insufficient;
}

function CrewCard({ row }: { row: RosterRow }) {
  const vitals = sortVitals(row.vitals);
  return (
    <Link
      href={`/surgeon/crew?id=${encodeURIComponent(row.crew_id)}`}
      data-testid={`crew-card-${row.crew_id}`}
      className="block rounded-card border border-border bg-card p-4 shadow-card transition-colors hover:bg-surface-2 focus-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-foreground">{row.name}</p>
        <StatusPill status={row.overall_status ?? "insufficient"} />
      </div>
      <p className="mt-1 text-sm text-muted">{timeAgo(row.last_check_in)}</p>

      <div className="mt-3">
        <ProgressBar
          value={row.checkin_days_7d}
          max={7}
          label={`${row.name}: ${row.checkin_days_7d} of 7 check-in days`}
        />
        <p className="mt-1 text-sm text-muted">
          {row.checkin_days_7d} check-in {row.checkin_days_7d === 1 ? "day" : "days"} in the last 7
          {row.open_reports > 0 && (
            <span className="ml-2 rounded-full bg-status-watch-bg px-2 py-0.5 text-xs font-semibold text-status-watch-fg">
              {row.open_reports} open {row.open_reports === 1 ? "report" : "reports"}
            </span>
          )}
        </p>
      </div>

      {vitals.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-y-1 text-sm">
          {vitals.slice(0, 6).map((vital) => (
            <div key={vital.metric} className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">{vitalLabel(vital.metric)}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {String(vital.value)} {vital.unit}
                </span>
                <span className={`h-2 w-2 rounded-full ${statusDot(vital.status)}`} aria-hidden />
                <span className="text-xs capitalize text-muted">{vital.status}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}

export function CrewBoard({ rows }: { rows: RosterRow[] }) {
  return (
    <section aria-label="Crew board" className="mt-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Crew</h2>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No crew on this device yet.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <CrewCard key={row.crew_id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
