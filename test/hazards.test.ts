import { describe, expect, it } from "vitest";
import { CATALOG } from "@starplus/core";
import { HAZARD_SECTIONS, measuresForHazard } from "../src/lib/hazards";
import { getKbEntry } from "../src/lib/kb";

describe("hazard sections", () => {
  it("covers the five mission hazards exactly once", () => {
    expect(HAZARD_SECTIONS.map((section) => section.key)).toEqual([
      "radiation",
      "isolation",
      "distance",
      "gravity",
      "environment",
    ]);
  });

  it("gives every hazard at least one tracked measure", () => {
    for (const section of HAZARD_SECTIONS) {
      expect(measuresForHazard(section.tag).length).toBeGreaterThan(0);
    }
  });

  it("tags every catalog measure with a known hazard", () => {
    const tags = new Set(HAZARD_SECTIONS.map((section) => section.tag));
    for (const measure of CATALOG.measures) {
      expect(measure.hazards.length).toBeGreaterThan(0);
      for (const tag of measure.hazards) {
        expect(tags.has(tag)).toBe(true);
      }
    }
  });

  it("has a knowledge entry with text and citations for every hazard", () => {
    for (const section of HAZARD_SECTIONS) {
      const entry = getKbEntry(section.kbKey);
      expect(entry).not.toBeNull();
      expect(entry?.text.length).toBeGreaterThan(0);
      expect(entry?.citations.length).toBeGreaterThan(0);
    }
  });
});
