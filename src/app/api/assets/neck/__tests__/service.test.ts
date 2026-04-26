import { describe, it, expect, vi } from "vitest";
import { createNeckAsset } from "../service";

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));
vi.mock("@/app/api/_shared/s3", () => ({
  signPutObjectUrl: vi.fn().mockResolvedValue("https://signed.example.com/put"),
}));

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const m of [
    "select",
    "eq",
    "insert",
    "update",
    "delete",
    "order",
    "limit",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

describe("createNeckAsset", () => {
  const userId = "user-1";
  const name = "My Neck";

  it("returns data with assetId and assetFileId on success", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const fileChain = makeChain({ data: { id: "file-1" }, error: null });
    const linkChain = makeChain({ data: null, error: null });

    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(assetChain)
        .mockReturnValueOnce(fileChain)
        .mockReturnValueOnce(linkChain),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createNeckAsset(db as any, userId, name);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ assetId: "asset-1", assetFileId: "file-1" });
  });

  it("returns a 400 error when the asset insert fails", async () => {
    const assetChain = makeChain({
      data: null,
      error: { message: "insert failed" },
    });
    const db = { from: vi.fn().mockReturnValue(assetChain) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createNeckAsset(db as any, userId, name);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
    expect(result.error?.message).toContain("insert failed");
  });

  it("returns a 400 error when the asset_file insert fails", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const fileChain = makeChain({
      data: null,
      error: { message: "file insert failed" },
    });
    const deleteChain = makeChain({ data: null, error: null });

    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(assetChain)
        .mockReturnValueOnce(fileChain)
        .mockReturnValueOnce(deleteChain),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createNeckAsset(db as any, userId, name);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });
});
