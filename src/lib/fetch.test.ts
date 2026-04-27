import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestJson } from "./fetch";

function makeResponse(ok: boolean, body: unknown) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  it("returns parsed JSON on a successful response", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(true, { id: 1 }));
    const result = await requestJson<{ id: number }>("/api/test");
    expect(result).toEqual({ id: 1 });
  });

  it("passes init options through to fetch", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(true, {}));
    await requestJson("/api/test", { method: "POST" });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/test", {
      method: "POST",
    });
  });

  it("throws the payload error string when the response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse(false, { error: "Not found" }),
    );
    await expect(requestJson("/api/test")).rejects.toThrow("Not found");
  });

  it("throws the default fallback when payload has no error string", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(false, {}));
    await expect(requestJson("/api/test")).rejects.toThrow("Request failed");
  });

  it("uses a custom fallbackError when payload has no error string", async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse(false, {}));
    await expect(
      requestJson("/api/test", undefined, "Custom error"),
    ).rejects.toThrow("Custom error");
  });

  it("falls back to fallbackError when JSON parsing fails on an error response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("invalid json")),
    } as unknown as Response);
    await expect(requestJson("/api/test")).rejects.toThrow("Request failed");
  });
});
