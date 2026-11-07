import { HeroSection } from "@/components/hero/hero-section";
import { BentoGrid } from "@/components/bento/bento-grid";
import { InfiniteMarquee } from "@/components/marquee/infinite-marquee";
import { HorizontalAccordion } from "@/components/accordion/horizontal-accordion";
import { VitalChart } from "@/components/dashboard/vital-chart";
import { RoleSwitcher } from "@/components/dashboard/role-switcher";
import { EmptyState } from "@/components/dashboard/empty-state";

const watchSignals: { title: string; content: string; status: "watch" | "normal" | "critical" }[] = [
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

const heartRateData = [
  { name: "00:00", value: 72 },
  { name: "00:15", value: 75 },
  { name: "00:30", value: 78 },
  { name: "00:45", value: 74 },
  { name: "01:00", value: 76 },
  { name: "01:15", value: 73 },
  { name: "01:30", value: 75 },
  { name: "01:45", value: 77 },
];

const spo2Data = [
  { name: "00:00", value: 98 },
  { name: "00:15", value: 97 },
  { name: "00:30", value: 98 },
  { name: "00:45", value: 99 },
  { name: "01:00", value: 98 },
  { name: "01:15", value: 97 },
  { name: "01:30", value: 98 },
  { name: "01:45", value: 99 },
];

export default function DashboardPage() {
  return (
    <main className="flex-1 overflow-x-hidden">
      <HeroSection />
      <BentoGrid />
      <HorizontalAccordion items={watchSignals} />
      <VitalChart title="Heart Rate" data={heartRateData} unit="bpm" />
      <VitalChart title="SpO2" data={spo2Data} unit="%" />
      <RoleSwitcher />
      <EmptyState
        title="No Active Alerts"
        description="All systems nominal. WATCH signals within 30-day baselines."
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
