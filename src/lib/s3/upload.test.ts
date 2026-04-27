import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadToSignedUrl } from "./upload";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadToSignedUrl", () => {
  it("resolves when the upload succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    await expect(
      uploadToSignedUrl(
        "https://s3.example.com/presigned",
        "model/gltf-binary",
        new Blob(),
      ),
    ).resolves.toBeUndefined();
  });

  it("throws when the upload response is not ok", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(
      uploadToSignedUrl(
        "https://s3.example.com/presigned",
        "model/gltf-binary",
        new Blob(),
      ),
    ).rejects.toThrow("Signed upload failed");
  });

  it("sends a PUT with the correct Content-Type header", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const body = new Blob(["data"], { type: "model/gltf-binary" });
    await uploadToSignedUrl(
      "https://s3.example.com/presigned",
      "model/gltf-binary",
      body,
    );
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://s3.example.com/presigned",
      {
        method: "PUT",
        headers: { "Content-Type": "model/gltf-binary" },
        body,
      },
    );
  });
});
