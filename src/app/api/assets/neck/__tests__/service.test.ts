import { describe, it, expect, vi, beforeEach } from "vitest";
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
  describe("happy path — upsertFile inserts with filename", () => {
    const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const assetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const hsId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    let modelInsert: ReturnType<typeof vi.fn>;
    let previewInsert: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("sets filename derived from object_key on both asset_file inserts", async () => {
      const hsChain = makeChain({
        data: { id: hsId, owner_id: userId, part_type: "headstock" },
        error: null,
      });
      const assetChain = makeChain({
        data: {
          id: assetId,
          owner_id: userId,
          part_type: "neck",
          asset_file_id: null,
          preview_file_id: null,
        },
        error: null,
      });

      modelInsert = vi
        .fn()
        .mockReturnValue(
          makeChain({ data: { id: "model-file-1" }, error: null }),
        );
      const modelChain = {
        ...makeChain({ data: { id: "model-file-1" }, error: null }),
        insert: modelInsert,
      };

      previewInsert = vi
        .fn()
        .mockReturnValue(
          makeChain({ data: { id: "preview-file-1" }, error: null }),
        );
      const previewChain = {
        ...makeChain({ data: { id: "preview-file-1" }, error: null }),
        insert: previewInsert,
      };

      const linkChain = makeChain({ data: null, error: null });

      const db = {
        from: vi
          .fn()
          .mockReturnValueOnce(hsChain)
          .mockReturnValueOnce(assetChain)
          .mockReturnValueOnce(modelChain)
          .mockReturnValueOnce(previewChain)
          .mockReturnValueOnce(linkChain),
      };

      const result = await saveNeckParams(db as unknown as Db, userId, {
        assetId,
        neckParams: { headstockAssetId: hsId },
        modelBytes: 1024,
        previewBytes: 512,
      });

      expect(result.error).toBeNull();

      const modelPayload = modelInsert.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(modelPayload).toMatchObject({ filename: "generated-neck.glb" });

      const previewPayload = previewInsert.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(previewPayload).toMatchObject({ filename: "generated-neck.png" });
    });
  });
});

describe("createNeckAsset", () => {
  const userId = "user-1";
  const name = "My Neck";

  it("returns data with assetId on success", async () => {
    const assetChain = makeChain({ data: { id: "asset-1" }, error: null });
    const db = { from: vi.fn().mockReturnValue(assetChain) };

    const result = await createNeckAsset(db as unknown as Db, userId, name);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ assetId: "asset-1" });
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
});
