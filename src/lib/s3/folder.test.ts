import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/s3/client";
import { userS3Folder } from "./folder";

vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn() },
  S3_BUCKET: "test-bucket",
}));

const s3Send = (s3Client as unknown as { send: ReturnType<typeof vi.fn> }).send;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("userS3Folder", () => {
  it("does not create a placeholder when the folder already exists", async () => {
    s3Send.mockResolvedValueOnce({ KeyCount: 1 });
    await userS3Folder("user-123");
    expect(s3Send).toHaveBeenCalledTimes(1);
    expect(s3Send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
  });

  it("creates a placeholder when the folder does not exist", async () => {
    s3Send.mockResolvedValueOnce({ KeyCount: 0 });
    s3Send.mockResolvedValueOnce({});
    await userS3Folder("user-456");
    expect(s3Send).toHaveBeenCalledTimes(2);
    expect(s3Send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
    expect(s3Send.mock.calls[1]?.[0]).toBeInstanceOf(PutObjectCommand);
  });

  it("treats undefined KeyCount as zero and creates the placeholder", async () => {
    s3Send.mockResolvedValueOnce({});
    s3Send.mockResolvedValueOnce({});
    await userS3Folder("user-789");
    expect(s3Send).toHaveBeenCalledTimes(2);
    expect(s3Send.mock.calls[1]?.[0]).toBeInstanceOf(PutObjectCommand);
  });

  it("uses the correct S3 prefix for the user", async () => {
    s3Send.mockResolvedValueOnce({ KeyCount: 1 });
    await userS3Folder("abc");
    const cmd = s3Send.mock.calls[0]?.[0] as ListObjectsV2Command;
    expect(cmd.input.Prefix).toBe("users/abc/");
    expect(cmd.input.Bucket).toBe("test-bucket");
  });
});
