import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapLibraryAssetRow } from "../mappers";
import { signGetFileUrl } from "@/app/api/_shared/s3";

vi.mock("@/app/api/_shared/s3", () => ({
  unwrapRelation: <T>(value: T | T[] | null | undefined): T | null => {
    if (!value) return null;
    return Array.isArray(value) ? (value[0] ?? null) : value;
  },
  signGetFileUrl: vi.fn(),
}));

const signGetFileUrlMock = vi.mocked(signGetFileUrl);

const baseRow = {
  id: "asset-1",
  name: "My Body",
  owner_id: "user-1",
  part_type: "body",
  upload_date: "2024-01-15T00:00:00.000Z",
  upload_status: "approved",
  preview_file: {
    object_key: "previews/body.png",
    bucket: null,
    mime_type: "image/png",
  },
  model_file: {
    object_key: "models/body.glb",
    bucket: null,
    mime_type: "model/gltf-binary",
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  signGetFileUrlMock.mockResolvedValue("https://cdn.example.com/file");
});

describe("mapLibraryAssetRow", () => {
  it("returns all expected scalar fields", async () => {
    const result = await mapLibraryAssetRow(baseRow);
    expect(result.id).toBe("asset-1");
    expect(result.name).toBe("My Body");
    expect(result.owner_id).toBe("user-1");
    expect(result.part_type).toBe("body");
    expect(result.upload_date).toBe("2024-01-15T00:00:00.000Z");
    expect(result.upload_status).toBe("approved");
  });

  it("returns signed URLs for preview and model files", async () => {
    const result = await mapLibraryAssetRow(baseRow);
    expect(result.previewUrl).toBe("https://cdn.example.com/file");
    expect(result.modelUrl).toBe("https://cdn.example.com/file");
  });

  it("calls signGetFileUrl with expiresIn 60 for both files", async () => {
    await mapLibraryAssetRow(baseRow);
    expect(signGetFileUrlMock).toHaveBeenCalledTimes(2);
    for (const call of signGetFileUrlMock.mock.calls) {
      expect(call[1]).toEqual({ expiresIn: 60 });
    }
  });

  it("passes null to signGetFileUrl when preview_file is null", async () => {
    signGetFileUrlMock.mockResolvedValue(null);
    const result = await mapLibraryAssetRow({ ...baseRow, preview_file: null });
    expect(result.previewUrl).toBeNull();
  });
});
