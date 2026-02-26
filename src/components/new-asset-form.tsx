"use client";

import { cn } from "@/lib/utils";
import { renderModelPreview } from "@/lib/model-preview";
import {
  IMPORTABLE_PART_TYPES,
  type PartType,
} from "@/components/new-project/constants";
import { requestJson } from "@/components/new-project/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React, { useState } from "react";

type NewAssetFormProps = React.ComponentPropsWithoutRef<"div"> & {
  onSuccess?: () => void;
};

type PresignResponse = {
  url: string;
  objectKey: string;
  contentType: string;
};

type FinalizeImportResponse = {
  assetId?: string;
};

async function uploadToSignedUrl(
  url: string,
  contentType: string,
  body: Blob | File,
) {
  const putRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!putRes.ok) {
    throw new Error("Signed upload failed");
  }
}

export function NewAssetForm({
  className,
  onSuccess,
  ...props
}: NewAssetFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [assetName, setAssetName] = useState("");
  const [partType, setPartType] = useState<PartType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateBeforeSubmit() {
    if (!file) {
      setError("Please select a file to import.");
      return false;
    }
    if (!assetName.trim()) {
      setError("Asset name is required.");
      return false;
    }
    if (!partType) {
      setError("Part type is required.");
      return false;
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!validateBeforeSubmit()) return;
    if (!file) return;

    setIsSubmitting(true);
    try {
      const modelPresign = await requestJson<PresignResponse>(
        "/api/models/import/presign",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "model/gltf-binary",
          }),
        },
        "Model presign failed",
      );

      await uploadToSignedUrl(modelPresign.url, modelPresign.contentType, file);

      const previewBlob = await renderModelPreview(file);

      const previewPresign = await requestJson<PresignResponse>(
        "/api/models/import/presign",
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
        "/api/models/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectKey: modelPresign.objectKey,
            filename: file.name,
            contentType: modelPresign.contentType,
            bytes: file.size,
            previewObjectKey: previewPresign.objectKey,
            previewContentType: previewPresign.contentType,
            previewBytes: previewBlob.size,
            assetName: assetName.trim(),
            partType,
          }),
        },
        "Finalize import failed",
      );

      if (!finalize.assetId) {
        throw new Error("Asset created, but no assetId returned.");
      }

      window.dispatchEvent(new Event("assets-changed"));
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Asset create failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn(className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>New Asset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="asset-name">Asset Name</Label>
                <Input
                  id="asset-name"
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="asset-file">Model File</Label>
                <input
                  id="asset-file"
                  type="file"
                  className="text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="asset-part-type">Part Type</Label>
                <Select
                  value={partType}
                  onValueChange={(value) => setPartType(value as PartType)}
                >
                  <SelectTrigger
                    id="asset-part-type"
                    className="w-full bg-(--background) text-(--foreground) border-(--foreground)"
                  >
                    <SelectValue placeholder="Select part type" />
                  </SelectTrigger>
                  <SelectContent className="bg-(--background) text-(--foreground) border-(--foreground)">
                    {IMPORTABLE_PART_TYPES.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="focus:bg-(--primary) focus:text-(--foreground)"
                      >
                        {type.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer w-full border border-(--primary)"
              >
                {isSubmitting ? "Uploading..." : "Add Asset"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
