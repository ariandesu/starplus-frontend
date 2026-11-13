import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@starplus/core";
import { WhatToDo } from "../src/components/what-to-do";
import { getKbEntry } from "../src/lib/kb";

const glucose = CATALOG.measures.find((m) => m.code === "blood_glucose")!;
const temp = CATALOG.measures.find((m) => m.code === "temperature_c")!;
const heart = CATALOG.measures.find((m) => m.code === "heart_rate")!;

async function renderHtml(props: {
  status: string;
  value: number | null;
  code: string;
}): Promise<string> {
  const measure = CATALOG.measures.find((m) => m.code === props.code);
  const kb = measure ? getKbEntry(measure.guidance_key) : null;
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  await act(async () => {
    root.render(
      <WhatToDo status={props.status} value={props.value} measure={measure} kb={kb} />
    );
  });
  const html = div.innerHTML;
  root.unmount();
  div.remove();
  return html;
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
}

describe("WhatToDo", () => {
  it("renders nothing for nominal measures", async () => {
    expect(await renderHtml({ status: "nominal", value: 72, code: "blood_glucose" })).toBe("");
  });

  it("links critical low glucose to the low-blood-sugar scenario once, with the warning", async () => {
    const html = await renderHtml({ status: "critical", value: 40, code: "blood_glucose" });
    expect(html).toContain("What to do");
    expect(html).toContain("needs fast sugar and the crew medical officer at once");
    expect(html).toContain("Related hazard:");
    expect(html).toContain("/hazards#isolation-confinement");
    expect(hrefs(html).filter((h) => h === "/emergency?scenario=low-blood-sugar")).toHaveLength(1);
    expect(html).toContain("Ask the crew medical officer before taking any medicine.");
  });

  it("links watch low glucose to the scenario without a duplicate emergency link", async () => {
    const html = await renderHtml({ status: "watch", value: 65, code: "blood_glucose" });
    expect(hrefs(html).filter((h) => h === "/emergency?scenario=low-blood-sugar")).toHaveLength(1);
    expect(html).toContain("Ask the crew medical officer before taking any medicine.");
  });

  it("links a watch high temperature to acetaminophen with the warning", async () => {
    const html = await renderHtml({ status: "watch", value: 39.5, code: "temperature_c" });
    expect(html).toContain("/medicines#acetaminophen");
    expect(html).toContain("Acetaminophen (paracetamol)");
    expect(html).toContain("Ask the crew medical officer before taking any medicine.");
    expect(html).not.toContain("Open Emergency");
  });

  it("links critical high heart rate to plain emergency with no medicine text", async () => {
    const html = await renderHtml({ status: "critical", value: 200, code: "heart_rate" });
    expect(html).toContain("Tell the crew medical officer about any amber or red result.");
    expect(hrefs(html)).toContain("/emergency");
    expect(html).not.toContain("/emergency?scenario=");
    expect(html).not.toContain("medicines#acetaminophen");
    expect(html).not.toContain("before taking any medicine");
  });

  it("falls back to the generic line when the KB has no escalation sentence", async () => {
    const html = await renderHtml({ status: "watch", value: 0.8, code: "radiation_dose" });
    expect(html).toContain("Tell the crew medical officer.");
  });
});
