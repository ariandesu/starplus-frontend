import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import HazardsPage from "../src/app/hazards/page";

describe("hazards page", () => {
  it("renders all five hazard sections with their tracked measures", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<HazardsPage />);
    });
    const text = div.textContent ?? "";
    for (const title of [
      "Space radiation",
      "Isolation and confinement",
      "Distance from Earth",
      "Altered gravity",
      "Hostile",
    ]) {
      expect(text).toContain(title);
    }
    for (const measure of ["Cumulative radiation dose", "Mood score", "Heart rate"]) {
      expect(text).toContain(measure);
    }
    expect(div.querySelector("h1")?.textContent).toBe("Hazards");
    expect(div.querySelector('a[href="/check"]')).not.toBeNull();
    root.unmount();
    div.remove();
  });
});
