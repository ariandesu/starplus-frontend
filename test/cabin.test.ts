import { describe, expect, it } from "vitest";
import { lookupMeasure } from "@starplus/core";
import { getKbEntry } from "../src/lib/kb";

const CABIN = [
  { code: "cabin_co2", guidance: "measure-cabin-co2", unit: "mmHg", alias: "ppco2" },
  { code: "cabin_o2", guidance: "measure-cabin-o2", unit: "mmHg", alias: "ppo2" },
  { code: "cabin_temperature", guidance: "measure-cabin-temperature", unit: "°C", alias: "cabin_temp" },
];

describe("cabin environment measures", () => {
  it("resolves every cabin code and alias in the catalog", () => {
    for (const cabin of CABIN) {
      const measure = lookupMeasure(cabin.code);
      expect(measure?.unit).toBe(cabin.unit);
      expect(measure?.hazards).toEqual(["hostile_environment"]);
      expect(measure?.limits).toEqual([]);
      expect(measure?.limit_source.length).toBeGreaterThan(0);
      expect(lookupMeasure(cabin.alias)?.code).toBe(cabin.code);
    }
  });

  it("has knowledge guidance with text and citations for every cabin measure", () => {
    for (const cabin of CABIN) {
      const entry = getKbEntry(cabin.guidance);
      expect(entry).not.toBeNull();
      expect(entry?.text.length).toBeGreaterThan(0);
      expect(entry?.citations.length).toBeGreaterThan(0);
    }
  });
});
