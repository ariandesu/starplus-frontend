import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OSD_575_GLUCOSE_MG_DL, OSD_575_URL, osd575GlucoseReference } from "../src/lib/osd575";
import { VitalChart } from "../src/components/dashboard/vital-chart";

describe("NASA OSDR OSD-575 glucose reference", () => {
  it("holds all 28 samples: 4 crew at 7 time points", () => {
    const samples = Object.keys(OSD_575_GLUCOSE_MG_DL);
    expect(samples).toHaveLength(28);
    for (const crew of ["C001", "C002", "C003", "C004"]) {
      for (const point of ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]) {
        expect(OSD_575_GLUCOSE_MG_DL[`${crew}_serum_${point}`]).toBeTypeOf("number");
      }
    }
  });

  it("matches the backend's documented figures: 24 samples, mean 80.5, SD 11.1", () => {
    const reference = osd575GlucoseReference();
    expect(reference.n).toBe(24);
    expect(reference.mean).toBe(80.5);
    expect(reference.sd).toBe(11.1);
    // Edges come from the unrounded mean (80.54) and SD (11.12): 69.43 and 91.66.
    expect(reference.low).toBe(69.4);
    expect(reference.high).toBe(91.7);
    expect(reference.sourceUrl).toBe(OSD_575_URL);
  });
});

describe("vital chart reference band caption", () => {
  async function render(node: React.ReactNode) {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(node);
    });
    return {
      div,
      done: () => {
        root.unmount();
        div.remove();
      },
    };
  }

  it("names the band, its range, its method and links the NASA source", async () => {
    const { div, done } = await render(
      <VitalChart
        title="Blood glucose"
        unit="mg/dL"
        data={[{ name: "1 Nov", value: 92 }]}
        reference={{
          low: 69.4,
          high: 91.7,
          label: "Inspiration4 crew range",
          detail: "mean ± 1 SD of 24 serum samples from 4 crew, R+45 left out",
          sourceName: "NASA OSDR OSD-575",
          sourceUrl: OSD_575_URL,
        }}
      />
    );
    const caption = div.querySelector('[data-testid="chart-reference"]');
    expect(caption?.textContent).toContain("Inspiration4 crew range, 69.4–91.7 mg/dL");
    expect(caption?.textContent).toContain("it does not change your status");
    const link = caption?.querySelector("a");
    expect(link?.textContent).toBe("NASA OSDR OSD-575");
    expect(link?.getAttribute("href")).toBe(OSD_575_URL);
    done();
  });

  it("shows no caption on charts without a reference", async () => {
    const { div, done } = await render(
      <VitalChart title="Heart rate" unit="bpm" data={[{ name: "1 Nov", value: 70 }]} />
    );
    expect(div.querySelector('[data-testid="chart-reference"]')).toBeNull();
    done();
  });
});
