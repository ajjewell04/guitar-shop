import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { unwrapRelation, signGetFileUrl, signPutObjectUrl } from "../s3";

vi.mock("@/lib/s3/client", () => ({
  s3Client: {},
  S3_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example.com/object"),
}));

beforeEach(() => {
  vi.mocked(getSignedUrl).mockResolvedValue(
    "https://signed.example.com/object",
  );
});

describe("unwrapRelation", () => {
  it("returns null for null", () => {
    expect(unwrapRelation(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(unwrapRelation(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(unwrapRelation([])).toBeNull();
  });

  it("returns the first element of a single-element array", () => {
    const obj = { id: "1", object_key: "key.glb" };
    expect(unwrapRelation([obj])).toEqual(obj);
  });

  it("returns the object directly when given a plain object", () => {
    const obj = { id: "1", object_key: "key.glb" };
    expect(unwrapRelation(obj)).toEqual(obj);
  });
});

describe("signGetFileUrl", () => {
  it("returns null when file is null", async () => {
    expect(await signGetFileUrl(null)).toBeNull();
  });

  it("returns null when file has no object_key", async () => {
    expect(await signGetFileUrl({ object_key: null })).toBeNull();
    expect(await signGetFileUrl({ object_key: undefined })).toBeNull();
  });

  it("returns a signed URL for a file with an object_key", async () => {
    const url = await signGetFileUrl({ object_key: "models/my-model.glb" });
    expect(url).toBe("https://signed.example.com/object");
  });

  it("passes the default expiresIn of 60 to getSignedUrl", async () => {
    await signGetFileUrl({ object_key: "models/my-model.glb" });
    expect(vi.mocked(getSignedUrl)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 60 },
    );
  });

  it("passes a custom expiresIn when provided", async () => {
    await signGetFileUrl(
      { object_key: "models/my-model.glb" },
      { expiresIn: 300 },
    );
    expect(vi.mocked(getSignedUrl)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 },
    );
  });
});

describe("signPutObjectUrl", () => {
  it("returns a signed URL", async () => {
    const url = await signPutObjectUrl({
      objectKey: "uploads/model.glb",
      contentType: "model/gltf-binary",
    });
    expect(url).toBe("https://signed.example.com/object");
  });

  it("passes the default expiresIn of 60 to getSignedUrl", async () => {
    await signPutObjectUrl({
      objectKey: "uploads/model.glb",
      contentType: "model/gltf-binary",
    });
    expect(vi.mocked(getSignedUrl)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 60 },
    );
  });
});
