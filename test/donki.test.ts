import { describe, expect, it, vi } from "vitest";
import { buildSepUrl, fetchSepEvents, parseSepEvents } from "../src/lib/donki";

describe("buildSepUrl", () => {
  it("asks for the last 30 days", () => {
    expect(buildSepUrl(new Date("2026-11-13T00:00:00Z"))).toBe(
      "https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2026-10-14&endDate=2026-11-13"
    );
  });
});

describe("parseSepEvents", () => {
  it("reads event times and instrument names", () => {
    expect(
      parseSepEvents([
        {
          sepID: 1,
          eventTime: "2026-10-20T12:00Z",
          instruments: [{ id: 7, displayName: "SOHO-ERNE" }],
          linkedEvents: null,
        },
      ])
    ).toEqual([{ eventTime: "2026-10-20T12:00Z", instruments: ["SOHO-ERNE"] }]);
  });

  it("returns nothing for garbage", () => {
    for (const payload of [null, {}, "nope", 42, [{ nope: true }], [{ eventTime: 42 }]]) {
      expect(parseSepEvents(payload)).toEqual([]);
    }
  });

  it("drops unreadable instruments but keeps the event", () => {
    expect(parseSepEvents([{ eventTime: "2026-10-20T12:00Z", instruments: [null, 7] }])).toEqual([
      { eventTime: "2026-10-20T12:00Z", instruments: [] },
    ]);
  });
});

describe("fetchSepEvents", () => {
  it("rejects when the feed is down", async () => {
    await expect(fetchSepEvents(() => Promise.reject(new Error("offline")))).rejects.toThrow();
    const bad = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    await expect(fetchSepEvents(bad)).rejects.toThrow("DONKI 500");
  });

  it("parses a live payload", async () => {
    const good = vi.fn(async () => ({
      ok: true,
      json: async () => [{ eventTime: "2026-10-20T12:00Z", instruments: [] }],
    }) as Response);
    await expect(fetchSepEvents(good)).resolves.toEqual([
      { eventTime: "2026-10-20T12:00Z", instruments: [] },
    ]);
  });
});
