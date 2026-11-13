import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ReportsInbox } from "../src/components/surgeon/reports-inbox";

const EVA_REPORT = {
  client_id: "r-eva-1",
  kind: "emergency",
  submitted_by: "demo-astronaut",
  received_at: "",
  created_at: "2026-11-13T08:00:00.000Z",
  summary_text: null,
  payload_json: JSON.stringify({ scenario: "eva", steps: [] }),
  status: "delivered",
};

const ROUTINE_REPORT = {
  ...EVA_REPORT,
  client_id: "r-routine-1",
  kind: "routine",
  payload_json: JSON.stringify({ scenario: "eva", steps: [] }),
};

describe("reports inbox", () => {
  it("shows the scenario label on emergency reports only", async () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => {
      root.render(
        <ReportsInbox
          token="tok"
          reports={[EVA_REPORT, ROUTINE_REPORT]}
          names={new Map([["demo-astronaut", "Alex Rivera"]])}
          onAcknowledge={() => undefined}
        />
      );
    });
    const items = [...div.querySelectorAll("li")];
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Scenario: Spacewalk emergency");
    expect(items[1].textContent).not.toContain("Scenario:");
    root.unmount();
    div.remove();
  });
});
