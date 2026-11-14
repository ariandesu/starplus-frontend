import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { Result } from "@starplus/core";
import { latestPerMeasure, type MeasureEntry } from "../src/lib/health-summary";
import { MeasuresCard, resultHref } from "../src/components/home/measures-card";
import { StatusHero } from "../src/components/home/status-hero";

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

function entry(metric: string, value: number, unit: string, status: string, resultId: string): MeasureEntry {
  return {
    metric,
    status,
    values: { value, unit, z_score: 0.5, baseline_mean: value, baseline_sd: 1 },
    assessed_at: "2026-11-13T12:00:00Z",
    result_id: resultId,
  } as unknown as MeasureEntry;
}

describe("latestPerMeasure", () => {
  it("records which result each measure came from", () => {
    const older = {
      client_id: "r-old",
      assessed_at: "2026-11-12T12:00:00Z",
      per_measure: [{ metric: "heart_rate" }, { metric: "mood_score" }],
    } as unknown as Result;
    const newer = {
      client_id: "r-new",
      assessed_at: "2026-11-13T12:00:00Z",
      per_measure: [{ metric: "heart_rate" }],
    } as unknown as Result;
    const byMetric = Object.fromEntries(latestPerMeasure([newer, older]).map((e) => [e.metric, e.result_id]));
    expect(byMetric).toEqual({ heart_rate: "r-new", mood_score: "r-old" });
  });
});

describe("Home measure tiles", () => {
  const entries = [entry("heart_rate", 112, "bpm", "watch", "r-1"), entry("spo2", 97, "%", "nominal", "r-2")];

  it("open the result each reading came from, with a descriptive label", async () => {
    const { div, done } = await render(<MeasuresCard entries={entries} checkHref="/check" crewId="demo astronaut" />);
    const link = div.querySelector<HTMLAnchorElement>('[data-testid="measure-link-heart_rate"]');
    expect(link?.getAttribute("href")).toBe("/result?crew=demo%20astronaut&result=r-1");
    expect(link?.getAttribute("aria-label")).toContain("112 bpm, watch. Open the result and what to do");
    expect(div.querySelector('[data-testid="measure-link-spo2"]')?.getAttribute("href")).toBe(resultHref("demo astronaut", "r-2"));
    done();
  });

  it("stay plain tiles when no crew is given", async () => {
    const { div, done } = await render(<MeasuresCard entries={entries} checkHref="/check" />);
    expect(div.querySelectorAll('[data-testid^="measure-link-"]')).toHaveLength(0);
    expect(div.textContent).toContain("112");
    done();
  });
});

describe("Home status panel", () => {
  it("links to the latest result when there is one", async () => {
    const { div, done } = await render(
      <StatusHero
        status="watch"
        assessedAt="2026-11-14T00:00:00Z"
        checkHref="/check"
        reportsHref="/reports"
        resultHref="/result?crew=c&result=r-9"
      />
    );
    const link = div.querySelector('[data-testid="latest-result-link"]');
    expect(link?.textContent).toBe("See your result and what to do");
    expect(link?.getAttribute("href")).toBe("/result?crew=c&result=r-9");
    done();
  });

  it("shows no result link before the first check", async () => {
    const { div, done } = await render(
      <StatusHero status={null} assessedAt={null} checkHref="/check" reportsHref="/reports" />
    );
    expect(div.querySelector('[data-testid="latest-result-link"]')).toBeNull();
    done();
  });
});
