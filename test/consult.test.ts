import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsultError, askQuestion, explainMedicine } from "../src/lib/consult";
import { deviceDb, profileDb } from "../src/lib/db";

let fetchCalls = 0;

function seedSession(crewId: string) {
  return (async () => {
    const device = await deviceDb();
    await device.put("profiles", {
      crew_id: crewId,
      display_name: "Test",
      token: "token-1",
      role: "astronaut",
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      provenance: "real",
      device_id: "device-1",
      pin_hash: null,
      shared_device: false,
    });
    await device.put("settings", { key: "device_id", value: "device-1" });
  })();
}

beforeEach(async () => {
  fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ answer: "A.", citations: [] }), { status: 200 });
  }) as typeof fetch;
  await seedSession("consult-crew");
});

describe("consult client", () => {
  it("asks a question with entry ids", async () => {
    let sent: unknown;
    globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
      fetchCalls += 1;
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ answer: "A.", citations: [] }), { status: 200 });
    }) as typeof fetch;
    const answer = await askQuestion("consult-crew", { question: "Why?", entryIds: ["measure-heart-rate"] });
    expect(answer.answer).toBe("A.");
    expect(sent).toMatchObject({ kind: "question", question: "Why?", entry_ids: ["measure-heart-rate"] });
  });

  it("maps a 429 to the flight-surgeon message", async () => {
    globalThis.fetch = (async () =>
      new Response("Question limit reached (10). For more help, contact your flight surgeon.", { status: 429 })) as typeof fetch;
    await expect(askQuestion("consult-crew", { question: "Why?", entryIds: ["x"] })).rejects.toMatchObject({
      status: 429,
    });
    try {
      await askQuestion("consult-crew", { question: "Why?", entryIds: ["x"] });
    } catch (err) {
      expect((err as ConsultError).message).toContain("flight surgeon");
    }
  });

  it("fetches a medicine explanation once, then serves the stored reply", async () => {
    const first = await explainMedicine("consult-crew", "acetaminophen");
    expect(first.cached).toBe(false);
    expect(fetchCalls).toBe(1);
    const second = await explainMedicine("consult-crew", "acetaminophen");
    expect(second.cached).toBe(true);
    expect(second.answer).toEqual(first.answer);
    expect(fetchCalls).toBe(1);
    const db = await profileDb("consult-crew");
    const stored = await db.get("content", "medicine-explainer:acetaminophen");
    expect(stored?.json).toContain("A.");
  });

  it("serves the stored reply while offline", async () => {
    await explainMedicine("consult-crew", "ibuprofen");
    const calls = fetchCalls;
    vi.stubGlobal("navigator", { onLine: false });
    try {
      const again = await explainMedicine("consult-crew", "ibuprofen");
      expect(again.cached).toBe(true);
      expect(fetchCalls).toBe(calls);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("asks to connect when offline with nothing stored", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    try {
      await expect(explainMedicine("consult-crew", "loratadine")).rejects.toMatchObject({ status: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
