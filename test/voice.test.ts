import { describe, expect, it } from "vitest";
import { extractReadings, parseSpokenNumber } from "../src/lib/adapters/voice";

describe("parseSpokenNumber", () => {
  it.each([
    ["zero", 0],
    ["seven", 7],
    ["nineteen", 19],
    ["seventy two", 72],
    ["one hundred and twenty", 120],
    ["two thousand three hundred and four", 2304],
    ["ninety eight point four", 98.4],
    ["thirty seven point five", 37.5],
    ["minus five", -5],
    ["negative twelve", -12],
    ["one hundred", 100],
  ])("parses %s as %s", (text, expected) => {
    expect(parseSpokenNumber(text)).toBe(expected);
  });

  it.each([[""], ["hello"], ["seventy apples"], ["point five six seven"], ["hundred"]])(
    "rejects %s",
    (text) => {
      expect(parseSpokenNumber(text)).toBeNull();
    }
  );
});

describe("extractReadings", () => {
  it("extracts a value with its unit", () => {
    expect(extractReadings("seventy two beats per minute")).toEqual([{ value: 72, unit: "bpm" }]);
  });

  it("extracts a decimal temperature", () => {
    expect(extractReadings("thirty seven point five degrees")).toEqual([{ value: 37.5, unit: "degC" }]);
  });

  it("falls back to a bare number without a unit", () => {
    expect(extractReadings("ninety eight point four")).toEqual([{ value: 98.4, unit: null }]);
  });

  it("returns nothing for prose without numbers", () => {
    expect(extractReadings("feeling fine today")).toEqual([]);
  });
});
