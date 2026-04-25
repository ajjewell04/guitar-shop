import { requestJson } from "@/lib/fetch";
import { uploadToSignedUrl } from "@/lib/upload";
import type { ProjectCreationStrategy } from "../utils";

type PresignResponse = {
  url: string;
  objectKey: string;
  contentType: string;
  uploadID: string;
};

type FinalizeImportResponse = {
  assetId?: string;
};

export const importStrategy: ProjectCreationStrategy = {
  async prepare(state, deps) {
    if (!state.file) throw new Error("Please select a file to import.");
    if (!state.assetName.trim())
      throw new Error("Asset name is required for import.");
    if (!state.partType) throw new Error("Part type is required for import.");

    const modelPresign = await requestJson<PresignResponse>(
      "/api/assets/import/presign",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: state.file.name,
          contentType: state.file.type || "model/gltf-binary",
        }),
      },
      "Model presign failed",
    );

    await uploadToSignedUrl(
      modelPresign.url,
      modelPresign.contentType,
      state.file,
    );

    const previewBlob = await deps.renderModelPreview(state.file);

    const previewPresign = await requestJson<PresignResponse>(
      "/api/assets/import/presign",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "preview.png",
          contentType: "image/png",
        }),
      },
      "Preview presign failed",
    );

    await uploadToSignedUrl(
      previewPresign.url,
      previewPresign.contentType,
      previewBlob,
    );

    const finalize = await requestJson<FinalizeImportResponse>(
      "/api/assets/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectKey: modelPresign.objectKey,
          filename: state.file.name,
          contentType: modelPresign.contentType,
          bytes: state.file.size,
          previewObjectKey: previewPresign.objectKey,
          previewFilename: "preview.png",
          previewContentType: previewPresign.contentType,
          previewBytes: previewBlob.size,
          assetName: state.assetName.trim(),
          partType: state.partType,
        }),
      },
      "Finalize import failed",
    );

    if (!finalize.assetId) {
      throw new Error("Import finalized but no assetId returned.");
    }

    return { importAssetId: finalize.assetId };
  },
};
