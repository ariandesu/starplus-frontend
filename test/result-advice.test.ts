import { describe, expect, it } from "vitest";
import { CATALOG, localDay, todayLocal } from "@starplus/core";
import { getKbEntry } from "../src/lib/kb";
import {
  ADVICE_FALLBACK,
  adviceSentence,
  hazardLinks,
  measureSide,
  orderResultEntries,
} from "../src/lib/result-advice";

const NOON = Date.parse("2026-11-12T12:00:00.000Z");

describe("adviceSentence", () => {
  it("quotes the heart-rate entry's escalation sentence word for word", () => {
    expect(adviceSentence(getKbEntry("measure-heart-rate"))).toBe(
      "Tell the crew medical officer about any amber or red result."
    );
  });

  it("picks the last matching sentence", () => {
    expect(adviceSentence(getKbEntry("measure-glucose"))).toBe(
      "Low blood sugar with confusion, shaking or sweating needs fast sugar and the crew medical officer at once."
    );
  });

  it("falls back when no sentence matches", () => {
    expect(adviceSentence(getKbEntry("measure-radiation"))).toBe(ADVICE_FALLBACK);
    expect(adviceSentence(null)).toBe(ADVICE_FALLBACK);
  });
});

describe("measureSide", () => {
  const temp = CATALOG.measures.find((m) => m.code === "temperature_c")!;
  const glucose = CATALOG.measures.find((m) => m.code === "blood_glucose")!;
  const heart = CATALOG.measures.find((m) => m.code === "heart_rate")!;

  it("reads the high and low sides from the catalog limits", () => {
    expect(measureSide(temp, 39.5)).toBe("high");
    expect(measureSide(temp, 34.0)).toBe("low");
    expect(measureSide(temp, 37.0)).toBeNull();
    expect(measureSide(glucose, 40)).toBe("low");
    expect(measureSide(glucose, 260)).toBe("high");
    expect(measureSide(glucose, 100)).toBeNull();
    expect(measureSide(heart, 200)).toBe("high");
    expect(measureSide(heart, 30)).toBe("low");
    expect(measureSide(undefined, 200)).toBeNull();
    expect(measureSide(temp, null)).toBeNull();
  });
});

describe("hazardLinks", () => {
  it("names each hazard like the hazards page and anchors by tag", () => {
    const heart = CATALOG.measures.find((m) => m.code === "heart_rate")!;
    expect(hazardLinks(heart)).toEqual([
      { name: "Altered gravity fields", href: "/hazards#altered-gravity" },
      { name: "Isolation and confinement", href: "/hazards#isolation-confinement" },
    ]);
  });

  it("returns nothing without a measure", () => {
    expect(hazardLinks(undefined)).toEqual([]);
  });
});

describe("orderResultEntries", () => {
  const at = (iso: string | null) => ({ status: "nominal", measured_at: iso });
  const measuredAt = (entry: { measured_at: string | null }) => entry.measured_at;

  it("orders critical, watch, today, then folds the rest", () => {
    const old = "2026-11-10T08:00:00.000Z";
    const fresh = "2026-11-12T08:00:00.000Z";
    const entries = [
      { status: "nominal", measured_at: old },
      { status: "nominal", measured_at: fresh },
      { status: "watch", measured_at: old },
      { status: "critical", measured_at: old },
      { status: "insufficient", measured_at: null },
    ];
    const { top, folded } = orderResultEntries(entries, measuredAt, "UTC", NOON);
    expect(top.map((e) => e.status)).toEqual(["critical", "watch", "nominal"]);
    expect(top[2]).toBe(entries[1]);
    expect(folded).toEqual([entries[0], entries[4]]);
  });

  it("keeps input order inside each group", () => {
    const old = "2026-11-10T08:00:00.000Z";
    const a = { status: "critical", measured_at: old };
    const b = { status: "critical", measured_at: old };
    const { top } = orderResultEntries([b, a], measuredAt, "UTC", NOON);
    expect(top).toEqual([b, a]);
  });

  it("uses the device time zone for today", () => {
    // 23:30 UTC on the 11th is already the 12th in Dhaka.
    const late = "2026-11-11T23:30:00.000Z";
    expect(localDay(late, "Asia/Dhaka")).toBe(todayLocal("Asia/Dhaka", NOON));
    const { folded } = orderResultEntries([at(late)], measuredAt, "UTC", NOON);
    expect(folded).toHaveLength(1);
    const { top } = orderResultEntries([at(late)], measuredAt, "Asia/Dhaka", NOON);
    expect(top).toHaveLength(1);
  });
});
