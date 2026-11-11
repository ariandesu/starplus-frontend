import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getCrewRoster, postReport, requestTimeoutMs } from "../src/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request timeouts", () => {
  it("gives reads ten seconds and writes forty-five", () => {
    expect(requestTimeoutMs(undefined)).toBe(10_000);
    expect(requestTimeoutMs("GET")).toBe(10_000);
    expect(requestTimeoutMs("POST")).toBe(45_000);
    expect(requestTimeoutMs("DELETE")).toBe(45_000);
  });

  it("passes an abort signal on a read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"crew":[]}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getCrewRoster("t");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("passes an abort signal on a write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await postReport("t", {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("turns a timeout into ApiError with status 0", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);

    const attempt = getCrewRoster("t");

    await expect(attempt).rejects.toBeInstanceOf(ApiError);
    await expect(attempt).rejects.toMatchObject({ status: 0 });
  });
});
