import { HeroSection, type HeroVital } from "@/components/hero/hero-section";
import { BentoGrid } from "@/components/bento/bento-grid";
import { InfiniteMarquee } from "@/components/marquee/infinite-marquee";
import { HorizontalAccordion, type AccordionItem } from "@/components/accordion/horizontal-accordion";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { RoleSwitcher, type RoleStat } from "@/components/dashboard/role-switcher";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DemoBadge } from "@/components/dashboard/demo-badge";
import { DashboardShell } from "@/components/navigation/dashboard-shell";
import {
  fetchAstronauts,
  fetchVitals,
  fetchWatchSignals,
  formatRelative,
  formatTimeUTC,
  describeWindow,
  type VitalReading,
} from "@/lib/api";

type Status = "normal" | "watch" | "critical";

// Simple reference ranges for flagging a single reading. Not clinical guidance.
const statusFor = {
  heart: (v: number): Status => (v < 40 || v > 120 ? "critical" : v < 50 || v > 100 ? "watch" : "normal"),
  spo2: (v: number): Status => (v < 90 ? "critical" : v < 95 ? "watch" : "normal"),
  temp: (v: number): Status => (v < 35 || v > 38.5 ? "critical" : v < 36 || v > 37.5 ? "watch" : "normal"),
  bp: (sys: number): Status => (sys >= 140 || sys < 85 ? "critical" : sys >= 130 || sys < 90 ? "watch" : "normal"),
};

// ---- Sample data, shown only when the backend has no rows (and labelled so) ----
const SAMPLE_SUBJECT = "A-04";
const SAMPLE_VITALS: HeroVital[] = [
  { label: "Heart Rate", value: "72", unit: "bpm", status: "normal", icon: "heart" },
  { label: "SpO2", value: "98", unit: "%", status: "normal", icon: "spo2" },
  { label: "Temperature", value: "36.8", unit: "°C", status: "normal", icon: "temp" },
  { label: "Blood Pressure", value: "118/76", unit: "mmHg", status: "normal", icon: "bp" },
];
const SAMPLE_HR = [72, 75, 78, 74, 76, 73, 75, 77];
const SAMPLE_SPO2 = [98, 97, 98, 99, 98, 97, 98, 99];
const sampleSeries = (values: number[]) =>
  values.map((value, i) => ({
    name: `${String(Math.floor((i * 15) / 60)).padStart(2, "0")}:${String((i * 15) % 60).padStart(2, "0")}`,
    value,
  }));
const SAMPLE_WATCH: AccordionItem[] = [
  {
    title: "Crew Member A-04",
    content: "Heart rate 12% above 30-day baseline, trending upward over the 72-hour window. Recommend cardiovascular assessment.",
    status: "watch",
  },
  {
    title: "Crew Member B-02",
    content: "SpO2 within nominal parameters. No deviations in the last 72 hours.",
    status: "normal",
  },
  {
    title: "Crew Member C-09",
    content: "Resting heart rate variability down 30% against baseline. Flight surgeon review requested.",
    status: "critical",
  },
  {
    title: "Crew Member D-01",
    content: "Sleep duration below baseline for three consecutive nights.",
    status: "watch",
  },
];
const SAMPLE_CREW = { active: 4, total: 4 };

function latestHeroVitals(vitals: VitalReading[]): HeroVital[] {
  const latest = <K extends keyof VitalReading>(key: K) => vitals.find((v) => v[key] != null)?.[key] ?? null;
  const hr = latest("heart_rate") as number | null;
  const spo2 = latest("oxygen_saturation") as number | null;
  const temp = latest("temperature_c") as number | null;
  const bpRow = vitals.find((v) => v.blood_pressure_systolic != null && v.blood_pressure_diastolic != null);

  return [
    { label: "Heart Rate", value: hr != null ? String(hr) : "-", unit: "bpm", status: hr != null ? statusFor.heart(hr) : "normal", icon: "heart" },
    { label: "SpO2", value: spo2 != null ? String(spo2) : "-", unit: "%", status: spo2 != null ? statusFor.spo2(spo2) : "normal", icon: "spo2" },
    { label: "Temperature", value: temp != null ? temp.toFixed(1) : "-", unit: "°C", status: temp != null ? statusFor.temp(temp) : "normal", icon: "temp" },
    {
      label: "Blood Pressure",
      value: bpRow ? `${bpRow.blood_pressure_systolic}/${bpRow.blood_pressure_diastolic}` : "-",
      unit: "mmHg",
      status: bpRow ? statusFor.bp(bpRow.blood_pressure_systolic!) : "normal",
      icon: "bp",
    },
  ];
}

/** API returns newest first; charts read left to right in time. */
function series(vitals: VitalReading[], key: "heart_rate" | "oxygen_saturation") {
  return vitals
    .filter((v) => v[key] != null)
    .slice(0, 24)
    .reverse()
    .map((v) => ({ name: formatTimeUTC(v.timestamp), value: v[key] as number }));
}

export default async function DashboardPage() {
  const [astronauts, watchSignals] = await Promise.all([fetchAstronauts(), fetchWatchSignals()]);

  const subjectId = astronauts?.[0]?.id ?? null;
  const subjectName = astronauts?.[0]?.name ?? null;
  const vitals = subjectId ? ((await fetchVitals(subjectId)) ?? []) : [];

  // ---- Vitals (hero + charts) ----
  const vitalsDemo = vitals.length === 0;
  const heroVitals = vitalsDemo ? SAMPLE_VITALS : latestHeroVitals(vitals);
  const hrSeries = vitalsDemo ? sampleSeries(SAMPLE_HR) : series(vitals, "heart_rate");
  const spo2Series = vitalsDemo ? sampleSeries(SAMPLE_SPO2) : series(vitals, "oxygen_saturation");

  // ---- WATCH signals ----
  const watchDemo = !watchSignals || watchSignals.length === 0;
  const watchItems: AccordionItem[] = watchDemo
    ? SAMPLE_WATCH
    : watchSignals.map((s) => ({
        title: astronauts?.find((a) => a.id === s.astronaut_id)?.name ?? `Crew Member ${s.astronaut_id}`,
        content: describeWindow(s),
        status: s.status === "nominal" ? "normal" : s.status,
        updated: formatRelative(s.updated_at),
      }));
  const watchCount = watchItems.filter((i) => i.status === "watch").length;
  const criticalCount = watchItems.filter((i) => i.status === "critical").length;

  // ---- Role stats (derived from the same data shown above) ----
  const crewDemo = !astronauts || astronauts.length === 0;
  const crew = crewDemo
    ? SAMPLE_CREW
    : { active: astronauts.filter((a) => a.status === "active").length, total: astronauts.length };
  const roleStats: RoleStat[] = [
    { label: "Active Crew", value: `${crew.active}/${crew.total}`, status: crew.active === crew.total ? "normal" : "watch" },
    { label: "WATCH Signals", value: String(watchCount), status: watchCount > 0 ? "watch" : "normal" },
    { label: "Critical Alerts", value: String(criticalCount), status: criticalCount > 0 ? "critical" : "normal" },
    { label: "Vitals Readings", value: vitalsDemo ? String(SAMPLE_HR.length) : String(vitals.length), status: "normal" },
  ];

  const apiDown = astronauts === null && watchSignals === null;

  return (
    <DashboardShell>
      {apiDown && (
        <div role="status" className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
          Backend unreachable. Showing sample data.
        </div>
      )}

      <HeroSection
        vitals={heroVitals}
        subject={vitalsDemo ? `Crew Member ${SAMPLE_SUBJECT}` : (subjectName ?? subjectId ?? "")}
        updated={vitalsDemo ? undefined : formatRelative(vitals[0].timestamp)}
        isDemo={vitalsDemo}
      />

      <HorizontalAccordion items={watchItems} isDemo={watchDemo} />

      <section className="px-4 pb-4 sm:px-6 max-w-6xl mx-auto w-full">
        <EmptyState
          tone={criticalCount > 0 ? "critical" : watchCount > 0 ? "watch" : "normal"}
          title={
            criticalCount > 0
              ? `${criticalCount} critical, ${watchCount} on WATCH`
              : watchCount > 0
                ? `${watchCount} WATCH signal${watchCount === 1 ? "" : "s"} open`
                : "No active alerts"
          }
          description={
            criticalCount + watchCount > 0
              ? "Review the deviations above with the flight medical officer."
              : "All tracked signals are within their 30-day baselines."
          }
        />
      </section>

      <section id="vitals" className="px-4 py-8 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Vital Trends</h2>
          {vitalsDemo && <DemoBadge />}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VitalChart title="Heart Rate" data={hrSeries} unit="bpm" />
          <VitalChart title="SpO2" data={spo2Series} unit="%" />
        </div>
        {!vitalsDemo && <p className="mt-2 text-xs text-muted">Times in UTC.</p>}
      </section>

      <BentoGrid />

      <RoleSwitcher stats={roleStats} isDemo={crewDemo && watchDemo && vitalsDemo} />

      <InfiniteMarquee
        items={[
          "STAR PLUS · Astronaut Health Monitoring",
          "WATCH Signals · 30-Day Baselines",
          "72-Hour Moving Window",
          "Mission Control Telemetry",
        ]}
      />
    </DashboardShell>
  );
}
