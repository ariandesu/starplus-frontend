import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { WaitingBanner, waitingBannerText } from "../src/components/waiting-banner";

function renderText(waiting: boolean, hasSession: boolean): string | null {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    act(() => {
      root.render(<WaitingBanner waiting={waiting} hasSession={hasSession} />);
    });
    return container.textContent;
  } finally {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
}

describe("waiting banner", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("says sending is underway when a session exists", () => {
    expect(waitingBannerText(true, true)).toBe("1 emergency report waiting — sending when the link is up.");
    expect(renderText(true, true)).toContain("sending when the link is up");
  });

  it("asks for login when no session exists", () => {
    expect(waitingBannerText(true, false)).toBe("1 emergency report waiting — log in to send it.");
    expect(renderText(true, false)).toContain("log in to send it");
  });

  it("renders nothing when nothing is waiting", () => {
    expect(waitingBannerText(false, true)).toBeNull();
    expect(waitingBannerText(false, false)).toBeNull();
    expect(renderText(false, true)).toBe("");
  });
});
