import { describe, expect, it } from "vitest";
import explainCache from "@starplus/core/content/explain-cache.json" with { type: "json" };
import { getExplanation, getKbEntry } from "../src/lib/kb";

type CacheFile = { entries: Record<string, { status: string }> };

function withAllRejected(): () => void {
  const cache = explainCache as unknown as CacheFile;
  const previous = new Map(Object.entries(cache.entries).map(([key, entry]) => [key, entry.status]));
  for (const entry of Object.values(cache.entries)) entry.status = "rejected";
  return () => {
    for (const [key, status] of previous) cache.entries[key].status = status;
  };
}

describe("getExplanation", () => {
  it("returns reviewed AI text for a reviewed entry", async () => {
    const entry = getKbEntry("measure-heart-rate");
    expect(entry).not.toBeNull();
    const text = await getExplanation("measure-heart-rate", "simple");
    expect(typeof text).toBe("string");
    expect(text!.length).toBeGreaterThan(0);
    expect(text).not.toBe(entry!.text.join("\n"));
  });

  it("returns null for rejected entries so the UI falls back to the source", async () => {
    const restore = withAllRejected();
    try {
      expect(await getExplanation("measure-heart-rate", "simple")).toBeNull();
      expect(await getExplanation("measure-spo2", "standard")).toBeNull();
    } finally {
      restore();
    }
    expect(await getExplanation("measure-heart-rate", "simple")).not.toBeNull();
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

  it("leaves every entry reviewed after the suite", () => {
    const cache = explainCache as unknown as CacheFile;
    expect(Object.values(cache.entries).every((entry) => entry.status === "reviewed")).toBe(true);
  });
});
