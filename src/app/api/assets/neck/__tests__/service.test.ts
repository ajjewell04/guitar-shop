import { describe, it, expect, vi } from "vitest";
import type { supabaseServer } from "@/lib/supabase/server";
import {
  createNeckAsset,
  getNeckPresignUrls,
  saveNeckParams,
} from "../service";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

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

describe("getNeckPresignUrls", () => {
  const userId = "user-1";
  const assetId = "asset-1";

  it("returns 404 when the asset is not found", async () => {
    const db = {
      from: vi
        .fn()
        .mockReturnValue(
          makeChain({ data: null, error: { message: "not found" } }),
        ),
    };
    const result = await getNeckPresignUrls(
      db as unknown as Db,
      userId,
      assetId,
    );
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(404);
  });

  it("returns 403 when another user owns the asset", async () => {
    const db = {
      from: vi.fn().mockReturnValue(
        makeChain({
          data: { id: assetId, owner_id: "other-user", part_type: "neck" },
          error: null,
        }),
      ),
    };
    const result = await getNeckPresignUrls(
      db as unknown as Db,
      userId,
      assetId,
    );
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(403);
  });

  it("returns 400 when the asset part_type is not 'neck'", async () => {
    const db = {
      from: vi.fn().mockReturnValue(
        makeChain({
          data: { id: assetId, owner_id: userId, part_type: "body" },
          error: null,
        }),
      ),
    };
    const result = await getNeckPresignUrls(
      db as unknown as Db,
      userId,
      assetId,
    );
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });
});

describe("saveNeckParams", () => {
  it("returns 400 when neckParams has no headstockAssetId", async () => {
    const db = { from: vi.fn() };
    const result = await saveNeckParams(db as unknown as Db, "user-1", {
      assetId: "asset-1",
      neckParams: {},
      modelObjectKey: "models/neck.glb",
      previewObjectKey: "previews/neck.png",
    });
    expect(result.error?.status).toBe(400);
    expect(result.error?.message).toContain("headstockAssetId");
    expect(db.from).not.toHaveBeenCalled();
  });
});

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

    const result = await createNeckAsset(db as unknown as Db, userId, name);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ assetId: "asset-1", assetFileId: "file-1" });
  });

  it("returns a 400 error when the asset insert fails", async () => {
    const assetChain = makeChain({
      data: null,
      error: { message: "insert failed" },
    });
    const db = { from: vi.fn().mockReturnValue(assetChain) };

    const result = await createNeckAsset(db as unknown as Db, userId, name);
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

    const result = await createNeckAsset(db as unknown as Db, userId, name);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });
});
