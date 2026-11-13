import { describe, expect, it } from "vitest";
import { inboxTitle, kindLabel, ownReportTitle, reportScenario, scenarioLabel, shortDate } from "../src/lib/report-title";

describe("report titles", () => {
  it("titles the inbox without raw IDs", () => {
    expect(inboxTitle("emergency", "Mia Chen", "2026-11-08T02:00:00.000Z")).toBe("Emergency · Mia Chen · 8 Nov");
    expect(inboxTitle("routine", "Alex Rivera", "2026-11-07T02:00:00.000Z")).toBe("Routine · Alex Rivera · 7 Nov");
  });

  it("titles own reports with kind, date and status", () => {
    expect(ownReportTitle("routine", "2026-11-08T02:00:00.000Z", "acknowledged")).toBe("Routine · 8 Nov · acknowledged");
    expect(ownReportTitle("emergency", "2026-11-09T18:00:00.000Z", "delivered")).toBe("Emergency · 9 Nov · delivered");
  });

  it("never leaks client IDs", () => {
    const id = "seed-demo-report-emergency";
    expect(inboxTitle("emergency", "Mia Chen", "2026-11-08T02:00:00.000Z")).not.toContain(id);
    expect(ownReportTitle("routine", "2026-11-08T02:00:00.000Z", "delivered")).not.toContain(id);
    expect(kindLabel("routine")).toBe("Routine");
    expect(shortDate("2026-11-08T02:00:00.000Z")).toBe("8 Nov");
  });

  it("labels known emergency scenarios and ignores the rest", () => {
    expect(scenarioLabel("eva")).toBe("Spacewalk emergency");
    expect(scenarioLabel("bleeding")).toBe("Severe bleeding");
    expect(scenarioLabel("nope")).toBeNull();
    expect(scenarioLabel(null)).toBeNull();
    expect(reportScenario(JSON.stringify({ scenario: "eva", steps: [] }))).toBe("Spacewalk emergency");
    expect(reportScenario(JSON.stringify({ scenario: "nope" }))).toBeNull();
    expect(reportScenario(JSON.stringify({}))).toBeNull();
    expect(reportScenario("not json")).toBeNull();
  });
});
