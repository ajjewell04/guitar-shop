import { describe, it, expect, vi } from "vitest";
import type { supabaseServer } from "@/lib/supabase/server";
import {
  TEMPLATE_S3_KEYS,
  getOwnedAsset,
  copyAssetToLibrary,
  createAssetFromTemplate,
} from "../service";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

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
  } as unknown as Db;
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

const validSource = {
  id: "source-1",
  name: "Strat Body",
  owner_id: "user-1",
  part_type: "body",
  upload_status: "approved",
  meta: null,
  model_file: {
    id: "mf-1",
    bucket: "my-bucket",
    object_key: "models/source.glb",
    mime_type: "model/gltf-binary",
    bytes: 1024,
  },
  preview_file: {
    id: "pf-1",
    bucket: "my-bucket",
    object_key: "previews/source.png",
    mime_type: "image/png",
    bytes: 512,
  },
};

describe("copyAssetToLibrary", () => {
  const userId = "user-1";
  const sourceAssetId = "source-1";

  it("returns 404 when the source asset is not found", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    const result = await copyAssetToLibrary(db, userId, sourceAssetId);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(404);
  });

  it("returns 400 when the source has no model or preview files", async () => {
    const db = makeDb({
      data: { ...validSource, model_file: null, preview_file: null },
      error: null,
    });
    const result = await copyAssetToLibrary(db, userId, sourceAssetId);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it("returns 400 when the new asset insert fails", async () => {
    const sourceChain = makeChain({ data: validSource, error: null });
    const insertChain = makeChain({
      data: null,
      error: { message: "insert failed" },
    });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(sourceChain)
        .mockReturnValueOnce(insertChain),
    } as unknown as Db;
    const result = await copyAssetToLibrary(db, userId, sourceAssetId);
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it("returns the new assetId on success", async () => {
    const sourceChain = makeChain({ data: validSource, error: null });
    const insertChain = makeChain({ data: { id: "new-asset-1" }, error: null });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(sourceChain)
        .mockReturnValueOnce(insertChain),
    } as unknown as Db;
    const result = await copyAssetToLibrary(db, userId, sourceAssetId);
    expect(result.error).toBeNull();
    expect(result.data?.assetId).toBe("new-asset-1");
    expect(result.data?.copiedFromAssetId).toBe("source-1");
  });
});

describe("createAssetFromTemplate", () => {
  const userId = "user-1";

  it("returns 400 when the asset insert fails", async () => {
    const db = makeDb({ data: null, error: { message: "insert failed" } });

    const result = await createAssetFromTemplate(db, userId, "stratocaster");
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it("returns 400 when the model file insert fails", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const modelFileChain = makeChain({
      data: null,
      error: { message: "file insert failed" },
    });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(assetChain)
        .mockReturnValueOnce(modelFileChain),
    } as unknown as Db;
    const result = await createAssetFromTemplate(db, userId, "stratocaster");
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it("returns 400 when the preview file insert fails", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const modelFileChain = makeChain({ data: { id: "file-1" }, error: null });
    const previewFileChain = makeChain({
      data: null,
      error: { message: "preview insert failed" },
    });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(assetChain)
        .mockReturnValueOnce(modelFileChain)
        .mockReturnValueOnce(previewFileChain),
    } as unknown as Db;
    const result = await createAssetFromTemplate(db, userId, "stratocaster");
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(400);
  });

  it("returns the new assetId on success", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const modelFileChain = makeChain({ data: { id: "file-1" }, error: null });
    const previewFileChain = makeChain({ data: { id: "file-2" }, error: null });
    const updateChain = makeChain({ data: null, error: null });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(assetChain)
        .mockReturnValueOnce(modelFileChain)
        .mockReturnValueOnce(previewFileChain)
        .mockReturnValueOnce(updateChain),
    } as unknown as Db;

    const result = await createAssetFromTemplate(db, userId, "stratocaster");
    expect(result.error).toBeNull();
    expect(result.data?.assetId).toBe("asset-1");
  });
});

describe("getOwnedAsset", () => {
  const userId = "user-1";
  const assetId = "asset-1";

  it("returns { asset, reason: null } when user owns the asset", async () => {
    const db = makeDb({ data: { id: assetId, owner_id: userId }, error: null });
    const result = await getOwnedAsset(db, assetId, userId);
    expect(result.reason).toBeNull();
    expect(result.asset).toBeDefined();
  });

  it("returns { asset: null, reason: 'not_found' } when the query errors", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    const result = await getOwnedAsset(db, assetId, userId);
    expect(result.reason).toBe("not_found");
    expect(result.asset).toBeNull();
  });

  it("returns { asset: null, reason: 'forbidden' } when another user owns the asset", async () => {
    const db = makeDb({
      data: { id: assetId, owner_id: "other-user" },
      error: null,
    });
    const result = await getOwnedAsset(db, assetId, userId);
    expect(result.reason).toBe("forbidden");
    expect(result.asset).toBeNull();
  });
});
