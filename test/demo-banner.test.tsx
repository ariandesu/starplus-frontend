import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DemoBannerStrip, OSD_575_URL } from "../src/components/navigation/dashboard-shell";

describe("demo banner strip", () => {
  it("keeps the exact demo banner text and names NASA OSDR OSD-575 beside it", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(<DemoBannerStrip />);
    });

    const banner = div.querySelector('[data-testid="demo-banner"]');
    expect(banner?.textContent).toBe("Demo: synthetic crew data");
    expect(banner?.getAttribute("role")).toBe("status");
    expect(div.querySelectorAll('[data-testid="demo-banner"]')).toHaveLength(1);

    const reference = div.querySelector('[data-testid="osdr-reference"]');
    expect(reference?.textContent).toBe(
      " · Glucose ranges checked against NASA OSDR OSD-575 (Inspiration4 crew)"
    );
    const link = reference?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(OSD_575_URL);
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");

    root.unmount();
    div.remove();
  });
});
