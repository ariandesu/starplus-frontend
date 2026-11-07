import { HeroSection } from "@/components/hero/hero-section";
import { BentoGrid } from "@/components/bento/bento-grid";
import { InfiniteMarquee } from "@/components/marquee/infinite-marquee";
import { HorizontalAccordion } from "@/components/accordion/horizontal-accordion";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { EmptyState } from "@/components/dashboard/empty-state";

const API_BASE = "https://starplus-backend.shareflow.workers.dev";

async function fetchWatchSignals() {
  try {
    const res = await fetch(`${API_BASE}/api/watch-signals`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch watch signals");
    const data = await res.json();
    return data.watch_signals || [];
  } catch {
    return [];
  }
}

async function fetchVitals(astronautId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/vitals/${astronautId}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch vitals");
    const data = await res.json();
    return data.vitals || [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const watchSignals = await fetchWatchSignals();
  const vitals = await fetchVitals("A-04");

  const heartRateData = vitals
    .filter((v: any) => v.heart_rate != null)
    .slice(0, 8)
    .map((v: any, i: number) => ({ name: `00:${i * 15}`, value: v.heart_rate }));

  const spo2Data = vitals
    .filter((v: any) => v.oxygen_saturation != null)
    .slice(0, 8)
    .map((v: any, i: number) => ({ name: `00:${i * 15}`, value: v.oxygen_saturation }));

  const fallbackHeartRate = [
    { name: "00:00", value: 72 },
    { name: "00:15", value: 75 },
    { name: "00:30", value: 78 },
    { name: "00:45", value: 74 },
    { name: "01:00", value: 76 },
    { name: "01:15", value: 73 },
    { name: "01:30", value: 75 },
    { name: "01:45", value: 77 },
  ];

  const fallbackSpO2 = [
    { name: "00:00", value: 98 },
    { name: "00:15", value: 97 },
    { name: "00:30", value: 98 },
    { name: "00:45", value: 99 },
    { name: "01:00", value: 98 },
    { name: "01:15", value: 97 },
    { name: "01:30", value: 98 },
    { name: "01:45", value: 99 },
  ];

  const accordionItems = watchSignals.length > 0
    ? watchSignals.map((s: any) => ({
        title: s.astronaut_id || "Crew Member",
        content: s.moving_window_72h || "No details available",
        status: s.status === "critical" ? "critical" : s.status === "watch" ? "watch" : "normal",
      }))
    : [
        {
          title: "Crew Member A-04",
          content: "Heart rate elevated 12% above 30-day baseline. Trending upward over 72-hour window. Recommend cardiovascular assessment.",
          status: "watch",
        },
        {
          title: "Crew Member B-02",
          content: "SpO2 within nominal parameters. No deviations detected in last 72 hours.",
          status: "normal",
        },
        {
          title: "Crew Member C-09",
          content: "CO2 levels trending above threshold in Module 3. ECLSS team notified.",
          status: "critical",
        },
        {
          title: "Crew Member D-01",
          content: "Sleep cycle disruption detected. Recommend melatonin protocol review.",
          status: "watch",
        },
      ];

  const hasAlerts = watchSignals.some(
    (s: any) => s.status === "watch" || s.status === "critical"
  );

  return (
    <main className="flex-1 overflow-x-hidden">
      <HeroSection />
      <BentoGrid />
      <HorizontalAccordion items={accordionItems} />
      <VitalChart
        title="Heart Rate"
        data={heartRateData.length > 0 ? heartRateData : fallbackHeartRate}
        unit="bpm"
      />
      <VitalChart
        title="SpO2"
        data={spo2Data.length > 0 ? spo2Data : fallbackSpO2}
        unit="%"
      />
      <RoleSwitcher />
      <EmptyState
        title={hasAlerts ? "Active WATCH Signals" : "No Active Alerts"}
        description={
          hasAlerts
            ? "Review vital deviations requiring medical attention."
            : "All systems nominal. WATCH signals within 30-day baselines."
        }
      />
      <InfiniteMarquee
        items={[
          "STAR PLUS · Astronaut Health Monitoring",
          "WATCH Signals · 30-Day Baselines",
          "72-Hour Moving Window",
          "Mission Control Telemetry",
          "Mobile-First Dashboard",
        ]}
      />
    </main>
  );
}
