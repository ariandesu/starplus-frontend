import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/use-active-crew", () => ({
  useActiveCrew: () => ({
    status: "none",
    crewId: null,
    session: null,
    crew: null,
    username: null,
    reason: null,
    candidates: [],
    ready: true,
    error: false,
  }),
}));

import FitnessReportPage from "../src/app/reports/fitness/page";

describe("fitness report page", () => {
  it("renders the report heading behind the session gate", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<FitnessReportPage />);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const text = div.textContent ?? "";
    expect(text).toContain("Fitness report");
    expect(div.querySelector("h1")?.textContent).toBe("Fitness report");
    root.unmount();
    div.remove();
  });
});
