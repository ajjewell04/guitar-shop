import { describe, it, expect, vi, beforeEach } from "vitest";
import { mapProjectListRow } from "../mappers";
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
  id: "project-1",
  owner_id: "user-1",
  name: "My Guitar",
  created_on: "2024-01-01T00:00:00.000Z",
  last_updated: "2024-06-01T00:00:00.000Z",
  preview_file: {
    object_key: "previews/project.png",
    bucket: null,
    mime_type: "image/png",
  },
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  signGetFileUrlMock.mockResolvedValue("https://cdn.example.com/preview.png");
});

describe("mapProjectListRow", () => {
  it("returns all expected scalar fields", async () => {
    const result = await mapProjectListRow(baseRow);
    expect(result.id).toBe("project-1");
    expect(result.owner_id).toBe("user-1");
    expect(result.name).toBe("My Guitar");
    expect(result.created_on).toBe("2024-01-01T00:00:00.000Z");
    expect(result.last_updated).toBe("2024-06-01T00:00:00.000Z");
  });

  it("returns a signed preview URL", async () => {
    const result = await mapProjectListRow(baseRow);
    expect(result.previewUrl).toBe("https://cdn.example.com/preview.png");
  });

  it("calls signGetFileUrl with expiresIn 300", async () => {
    await mapProjectListRow(baseRow);
    expect(signGetFileUrlMock).toHaveBeenCalledWith(expect.anything(), {
      expiresIn: 300,
    });
  });

  it("returns null previewUrl when preview_file is null", async () => {
    signGetFileUrlMock.mockResolvedValue(null);
    const result = await mapProjectListRow({ ...baseRow, preview_file: null });
    expect(result.previewUrl).toBeNull();
  });
});
