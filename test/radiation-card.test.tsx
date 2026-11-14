import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Measurement } from "@starplus/core";
import { RadiationCard } from "../src/components/home/radiation-card";

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // jsdom without an origin: storage is unavailable and the hook treats it as an empty cache.
  }
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("raises no alert when the space-weather feed is down, but names the NASA source", async () => {
    const { div, done } = await renderCard([]);
    expect(div.querySelector('[role="status"]')).toBeNull();
    expect(div.querySelector('[data-testid="donki-line"]')?.textContent).toContain(
      "Live space weather from NASA DONKI loads when the device is online."
    );
    done();
  });

  it("shows a quiet NASA DONKI line when there were no events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] })) as unknown as typeof fetch
    );
    const { div, done } = await renderCard([]);
    expect(div.querySelector('[role="status"]')).toBeNull();
    expect(div.querySelector('[data-testid="donki-line"]')?.textContent).toContain(
      "No solar particle events in the last 30 days (NASA DONKI space weather"
    );
    done();
  });

  it("shows the solar-particle notice when DONKI reports events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { eventTime: "2026-11-10T12:00Z", instruments: [{ displayName: "SOHO-ERNE" }] },
          { eventTime: "2026-11-11T12:00Z", instruments: [] },
        ],
      })) as unknown as typeof fetch
    );
    const { div, done } = await renderCard([]);
    const notice = div.querySelector('[role="status"]');
    expect(notice?.textContent).toContain("2 solar particle events recorded");
    expect(notice?.textContent).toContain("NASA DONKI space weather");
    expect(div.querySelector('[data-testid="donki-line"]')).toBeNull();
    expect(notice?.querySelector('a[href="/hazards"]')).not.toBeNull();
    done();
  });
});
