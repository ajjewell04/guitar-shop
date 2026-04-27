import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "@/lib/s3/client";
import {
  unwrapRelation,
  signGetFileUrl,
  signPutObjectUrl,
  deleteObjectsByBucket,
} from "../s3";

vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example.com/object"),
}));

// Cast to a plain-property type so the unbound-method rule does not fire.
const s3Send = (s3Client as unknown as { send: ReturnType<typeof vi.fn> }).send;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSignedUrl).mockResolvedValue(
    "https://signed.example.com/object",
  );
  s3Send.mockResolvedValue({});
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

describe("deleteObjectsByBucket", () => {
  it("does not call s3Client.send when all files have null object_key", async () => {
    await deleteObjectsByBucket([
      { bucket: "my-bucket", object_key: null },
      { bucket: "my-bucket", object_key: null },
    ]);
    expect(s3Send).not.toHaveBeenCalled();
  });

  it("calls s3Client.send once for a batch of files in the same bucket", async () => {
    await deleteObjectsByBucket([
      { bucket: "my-bucket", object_key: "models/a.glb" },
      { bucket: "my-bucket", object_key: "models/b.glb" },
    ]);
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it("falls back to S3_BUCKET when bucket is null", async () => {
    await deleteObjectsByBucket([{ bucket: null, object_key: "models/a.glb" }]);
    expect(s3Send).toHaveBeenCalledTimes(1);
    const cmd = s3Send.mock.calls[0]?.[0] as { input: { Bucket: string } };
    expect(cmd.input.Bucket).toBe("test-bucket");
  });

  it("calls s3Client.send separately for files in different buckets", async () => {
    await deleteObjectsByBucket([
      { bucket: "bucket-a", object_key: "models/a.glb" },
      { bucket: "bucket-b", object_key: "models/b.glb" },
    ]);
    expect(s3Send).toHaveBeenCalledTimes(2);
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
