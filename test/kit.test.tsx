import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusPill } from "../src/components/ui/status-pill";
import { SegmentedControl } from "../src/components/ui/segmented-control";
import { ProgressBar } from "../src/components/ui/progress-bar";
import { markerPosition } from "../src/components/dashboard/range-bar";

function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("status pill", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it.each(["nominal", "watch", "critical", "insufficient"])(
    "renders %s as the lower-case word with an icon",
    (status) => {
      const { container, unmount } = mount(<StatusPill status={status} />);
      try {
        expect(container.textContent).toBe(status);
        expect(container.querySelector("svg")).not.toBeNull();
      } finally {
        unmount();
      }
    }
  );

  it("treats an unknown status as insufficient", () => {
    const { container, unmount } = mount(<StatusPill status="unknown" />);
    try {
      expect(container.textContent).toBe("insufficient");
      expect(container.querySelector("svg")).not.toBeNull();
    } finally {
      unmount();
    }
  });
});

describe("range bar marker position", () => {
  it("maps a z score onto the track", () => {
    expect(markerPosition(null)).toBeNull();
    expect(markerPosition(0)).toBe(0.5);
    expect(markerPosition(-3)).toBe(0);
    expect(markerPosition(3)).toBe(1);
    expect(markerPosition(-9)).toBe(0);
    expect(markerPosition(9)).toBe(1);
  });
});

describe("progress bar", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("exposes its values and label", () => {
    const { container, unmount } = mount(<ProgressBar value={3} max={7} label="Check-ins" />);
    try {
      const bar = container.querySelector('[role="progressbar"]');
      expect(bar).not.toBeNull();
      expect(bar?.getAttribute("aria-valuenow")).toBe("3");
      expect(bar?.getAttribute("aria-valuemin")).toBe("0");
      expect(bar?.getAttribute("aria-valuemax")).toBe("7");
      expect(bar?.getAttribute("aria-label")).toBe("Check-ins");
    } finally {
      unmount();
    }
  });

  it("draws no fill when the maximum is zero", () => {
    const { container, unmount } = mount(<ProgressBar value={4} max={0} label="Check-ins" />);
    try {
      const fill = container.querySelector('[role="progressbar"] > div') as HTMLElement | null;
      expect(fill?.style.width).toBe("0%");
    } finally {
      unmount();
    }
  });
});

describe("segmented control", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("marks the selected option and reports a change", () => {
    const onChange = vi.fn();
    const { container, unmount } = mount(
      <SegmentedControl
        options={[
          { value: "7d", label: "7D" },
          { value: "30d", label: "30D" },
        ]}
        value="7d"
        onChange={onChange}
        ariaLabel="Range"
      />
    );
    try {
      const buttons = Array.from(container.querySelectorAll("button"));
      expect(buttons).toHaveLength(2);
      expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
      expect(buttons[1].getAttribute("aria-pressed")).toBe("false");

      act(() => {
        buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("30d");
    } finally {
      unmount();
    }
  });
});
