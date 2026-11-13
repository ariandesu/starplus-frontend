import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import EmergencyPage from "../src/app/emergency/page";

describe("emergency page", () => {
  let div: HTMLElement;
  let done: () => void;

  beforeEach(async () => {
    div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    done = () => {
      root.unmount();
      div.remove();
    };
    await act(async () => {
      root.render(<EmergencyPage />);
    });
  });

  afterEach(() => {
    done();
  });

  it("offers the eight original scenarios plus the spacewalk emergency", async () => {
    const labels = [...div.querySelectorAll("button")].map((button) => button.textContent ?? "");
    for (const name of [
      "Someone else, not responding",
      "Me, chest pain",
      "Choking",
      "Severe bleeding",
      "Burns",
      "Allergic reaction",
      "Low blood sugar",
      "Fainting",
      "Spacewalk emergency",
    ]) {
      expect(labels.some((label) => label.includes(name)), name).toBe(true);
    }
  });
});
