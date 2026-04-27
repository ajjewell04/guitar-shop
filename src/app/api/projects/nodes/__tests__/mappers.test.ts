import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapNodeRow, mapLibraryAssetRow } from "../mappers";
import { signGetFileUrl } from "@/app/api/_shared/s3";

vi.mock("@/app/api/_shared/s3", () => ({
  unwrapRelation: <T>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  },
  signGetFileUrl: vi.fn(),
}));

const signGetFileUrlMock = vi.mocked(signGetFileUrl);

const baseNode = {
  id: "node-1",
  project_id: "project-1",
  type: "asset",
  parent_id: null,
  sort_index: 0,
  name: "Body",
  asset_id: "asset-1",
  transforms: {
    position: { x: 1, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
  },
  last_updated: "2024-01-01T00:00:00.000Z",
  asset: {
    id: "asset-1",
    name: "Strat Body",
    part_type: "body",
    meta: {},
    model_file: {
      object_key: "models/body.glb",
      bucket: null,
      mime_type: "model/gltf-binary",
    },
    preview_file: {
      object_key: "previews/body.png",
      bucket: null,
      mime_type: "image/png",
    },
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  signGetFileUrlMock.mockResolvedValue("https://cdn.example.com/file");
});

describe("mapNodeRow", () => {
  it("returns all expected scalar fields", async () => {
    const result = await mapNodeRow(baseNode);
    expect(result.id).toBe("node-1");
    expect(result.project_id).toBe("project-1");
    expect(result.type).toBe("asset");
    expect(result.parent_id).toBeNull();
    expect(result.sort_index).toBe(0);
    expect(result.name).toBe("Body");
    expect(result.asset_id).toBe("asset-1");
  });

  it("defaults transforms to {} when node.transforms is null/undefined", async () => {
    const result = await mapNodeRow({ ...baseNode, transforms: undefined });
    expect(result.transforms).toEqual({});
  });

  it("returns null asset when node.asset is null", async () => {
    const result = await mapNodeRow({ ...baseNode, asset: null });
    expect(result.asset).toBeNull();
  });

  it("defaults meta to {} when asset.meta is null", async () => {
    const result = await mapNodeRow({
      ...baseNode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asset: { ...baseNode.asset, meta: null as any },
    });
    expect(result.asset!.meta).toEqual({});
  });

  it("maps nested asset fields when asset is present", async () => {
    const result = await mapNodeRow(baseNode);
    expect(result.asset).not.toBeNull();
    expect(result.asset!.id).toBe("asset-1");
    expect(result.asset!.name).toBe("Strat Body");
    expect(result.asset!.part_type).toBe("body");
    expect(result.asset!.modelUrl).toBe("https://cdn.example.com/file");
    expect(result.asset!.previewUrl).toBe("https://cdn.example.com/file");
  });
});

describe("mapLibraryAssetRow (nodes)", () => {
  const baseAsset = {
    id: "asset-1",
    name: "Strat Body",
    part_type: "body",
    upload_date: "2024-01-01T00:00:00.000Z",
    model_file: {
      object_key: "models/body.glb",
      bucket: null,
      mime_type: "model/gltf-binary",
    },
    preview_file: {
      object_key: "previews/body.png",
      bucket: null,
      mime_type: "image/png",
    },
  } as const;

  it("returns expected scalar fields", async () => {
    const result = await mapLibraryAssetRow(baseAsset);
    expect(result.id).toBe("asset-1");
    expect(result.name).toBe("Strat Body");
    expect(result.part_type).toBe("body");
    expect(result.upload_date).toBe("2024-01-01T00:00:00.000Z");
  });

  it("calls signGetFileUrl with expiresIn 60 for model and preview", async () => {
    await mapLibraryAssetRow(baseAsset);
    expect(signGetFileUrlMock).toHaveBeenCalledTimes(2);
    for (const call of signGetFileUrlMock.mock.calls) {
      expect(call[1]).toEqual({ expiresIn: 60 });
    }
  });
});
