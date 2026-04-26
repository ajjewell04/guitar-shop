import { describe, it, expect, vi } from "vitest";
import { TEMPLATE_S3_KEYS, getOwnedAsset } from "../service";

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));
vi.mock("@/lib/s3/folder", () => ({
  userS3Folder: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/app/api/_shared/s3", () => ({
  unwrapRelation: <T>(v: T | T[] | null | undefined): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  },
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

function makeDb(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue(makeChain(result)),
    rpc: vi.fn().mockReturnValue(makeChain(result)),
  };
}

describe("TEMPLATE_S3_KEYS", () => {
  it("contains entries for all three template keys", () => {
    expect(Object.keys(TEMPLATE_S3_KEYS)).toEqual(
      expect.arrayContaining(["stratocaster", "telecaster", "les-paul"]),
    );
  });

  it("each entry has a glb path and a preview path", () => {
    for (const key of Object.keys(
      TEMPLATE_S3_KEYS,
    ) as (keyof typeof TEMPLATE_S3_KEYS)[]) {
      expect(TEMPLATE_S3_KEYS[key].glb).toMatch(/\.glb$/);
      expect(TEMPLATE_S3_KEYS[key].preview).toMatch(/\.png$/);
    }
  });
});

describe("getOwnedAsset", () => {
  const userId = "user-1";
  const assetId = "asset-1";

  it("returns { asset, reason: null } when user owns the asset", async () => {
    const db = makeDb({ data: { id: assetId, owner_id: userId }, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedAsset(db as any, assetId, userId);
    expect(result.reason).toBeNull();
    expect(result.asset).toBeDefined();
  });

  it("returns { asset: null, reason: 'not_found' } when the query errors", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedAsset(db as any, assetId, userId);
    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
  });

  it("returns { asset: null, reason: 'forbidden' } when another user owns the asset", async () => {
    const db = makeDb({
      data: { id: assetId, owner_id: "other-user" },
      error: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedAsset(db as any, assetId, userId);
    expect(result.reason).toBe("forbidden");
    expect(result.asset).toBeNull();
  });
});
