import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { Measurement } from "@starplus/core";
import { RadiationCard } from "../src/components/home/radiation-card";

function reading(value_num: number, measured_at: string): Measurement {
  return {
    client_id: `c-${measured_at}`,
    crew_id: "crew-1",
    metric: "radiation_dose",
    value_num,
    value_text: null,
    unit: "mSv",
    measured_at,
    received_at: measured_at,
    source: "manual",
    device_id: "",
    capture_id: null,
    is_estimate: 0,
    confirmed_by_user: 0,
    provenance: "real",
    setting: "iss",
    phase: "inflight",
  } as Measurement;
}

async function renderCard(measurements: Measurement[]): Promise<{ div: HTMLElement; done: () => void }> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => {
    root.render(<RadiationCard measurements={measurements} />);
  });
  return {
    div,
    done: () => {
      root.unmount();
      div.remove();
    },
  };
}

describe("radiation card", () => {
  it("shows the empty state with no readings", async () => {
    const { div, done } = await renderCard([]);
    expect(div.textContent).toContain("No dosimeter readings logged yet.");
    expect(div.querySelector('a[href="/check"]')).not.toBeNull();
    done();
  });

  it("shows the total, the share of the career limit and the daily report link", async () => {
    const { div, done } = await renderCard([
      reading(0.5, "2026-11-01T08:00:00Z"),
      reading(0.5, "2026-11-11T08:00:00Z"),
    ]);
    const text = div.textContent ?? "";
    expect(text).toContain("1.0");
    expect(text).toContain("0.2% of the 600 mSv career limit");
    expect(text).toContain("Source: NASA-STD-3001 Vol. 1 Rev. B.");
    expect(div.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(div.querySelector('a[href="/reports"]')).not.toBeNull();
    done();
  });

  it("shows the milestone banner at 25 percent", async () => {
    const { div, done } = await renderCard([reading(150, "2026-11-01T08:00:00Z")]);
    const banner = div.querySelector('[role="status"]');
    expect(banner?.textContent).toContain("reached 25% of the 600 mSv career limit");
    expect(banner?.querySelector('a[href="/hazards"]')).not.toBeNull();
    done();
  });
});
