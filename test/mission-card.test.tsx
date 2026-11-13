import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { MissionCard } from "../src/components/mission-card";

describe("mission card", () => {
  it("renders eleven daily-step tiles", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<MissionCard crewId="crew-1" />);
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const tiles = div.querySelectorAll('[data-testid^="mission-tile-"]');
    expect(tiles.length).toBe(11);
    for (const key of ["cabin_co2", "cabin_o2", "cabin_temperature"]) {
      expect(div.querySelector(`[data-testid="mission-tile-${key}"]`)).not.toBeNull();
    }
    expect(div.textContent).toContain("of 11 done today");
    root.unmount();
    div.remove();
  });
});
