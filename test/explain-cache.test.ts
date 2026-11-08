import { describe, expect, it } from "vitest";
import { getExplanation, getKbEntry } from "../src/lib/kb";

describe("getExplanation", () => {
  it("returns reviewed AI text for a reviewed entry", async () => {
    const entry = getKbEntry("measure-heart-rate");
    expect(entry).not.toBeNull();
    const text = await getExplanation("measure-heart-rate", "simple");
    expect(typeof text).toBe("string");
    expect(text!.length).toBeGreaterThan(0);
    expect(text).not.toBe(entry!.text.join("\n"));
  });

  it("returns null for a rejected entry so the UI falls back to the source", async () => {
    expect(await getExplanation("firstaid-cpr", "simple")).toBeNull();
    expect(await getExplanation("measure-temperature", "standard")).toBeNull();
  });

  it("returns null when the source text changed after review", async () => {
    const entry = getKbEntry("measure-spo2");
    expect(entry).not.toBeNull();
    const baseline = await getExplanation("measure-spo2", "simple");
    expect(typeof baseline).toBe("string");
    const original = [...entry!.text];
    entry!.text = [...original, "An extra sentence added after review."];
    try {
      expect(await getExplanation("measure-spo2", "simple")).toBeNull();
    } finally {
      entry!.text = original;
    }
    expect(await getExplanation("measure-spo2", "simple")).toBe(baseline);
  });

  it("returns null for an unknown entry", async () => {
    expect(await getExplanation("no-such-entry", "simple")).toBeNull();
  });
});
