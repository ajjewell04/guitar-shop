"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { renderModelPreview } from "@/lib/model-preview";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ApprovedAssetRow = {
  id: string;
  name: string;
  owner_id: string;
  part_type: string | null;
  upload_date: string;
  upload_status: string | null;
  previewUrl: string | null;
  modelUrl: string | null;
};

type CommunityLibraryViewProps = React.ComponentPropsWithoutRef<"div"> & {
  ownerId?: string;
  initialAssets: ApprovedAssetRow[];
};

export default function CommunityLibraryView({
  className,
  ownerId,
  initialAssets,
}: CommunityLibraryViewProps) {
  const [assets, setAssets] = useState<ApprovedAssetRow[]>(initialAssets);
  const [error, setError] = useState<string | null>(null);
  const [copyingAssetId, setCopyingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const attemptedRef = useRef<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const isCommunityView = !ownerId;

  async function addToMyLibrary(sourceAssetId: string) {
    setCopyingAssetId(sourceAssetId);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "copy_to_library",
          sourceAssetId,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to add asset to My Library");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add asset";
      setError(msg);
    } finally {
      setCopyingAssetId(null);
    }
  }

  async function deleteFromLibrary(assetId: string) {
    setError(null);
    setDeletingAssetId(assetId);

    const previousAssets = assets;
    setAssets((prev) => prev.filter((a) => a.id !== assetId));

    try {
      const res = await fetch("/api/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAssets(previousAssets);
        throw new Error(payload?.error ?? "Failed to delete asset");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete asset";
      setError(msg);
    } finally {
      setDeletingAssetId(null);
    }
  }

  async function generatePreview(asset: ApprovedAssetRow) {
    if (!asset.modelUrl) throw new Error("Model URL is missing");

    const modelRes = await fetch(asset.modelUrl);
    if (!modelRes.ok) {
      throw new Error("Failed to download model");
    }

    const modelBlob = await modelRes.blob();
    const modelFile = new File([modelBlob], `${asset.name}.glb`, {
      type: modelBlob.type || "model/gltf-binary",
    });

    const previewBlob = await renderModelPreview(modelFile);

    const presignRes = await fetch("/api/assets/preview/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        kind: "preview",
        filename: "preview.png",
        contentType: "image/png",
      }),
    });
    const presignData = await presignRes.json();
    if (!presignRes.ok)
      throw new Error(presignData?.error ?? "Preview presign failed");

    const putRes = await fetch(presignData.url, {
      method: "PUT",
      headers: { "Content-Type": presignData.contentType },
      body: previewBlob,
    });
    if (!putRes.ok) throw new Error("Preview upload failed");

    const finalizeRes = await fetch("/api/assets/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        previewObjectKey: presignData.objectKey,
        previewContentType: presignData.contentType,
        previewBytes: previewBlob.size,
      }),
    });
    const finalizeData = await finalizeRes.json();
    if (!finalizeRes.ok)
      throw new Error(finalizeData?.error ?? "Finalize preview failed");

    setAssets((prev) =>
      prev.map((a) =>
        a.id === asset.id
          ? { ...a, previewUrl: finalizeData.previewUrl ?? a.previewUrl }
          : a,
      ),
    );
  }

  useEffect(() => {
    if (assets.length === 0) return;

    const missing = assets.filter(
      (asset) =>
        !asset.previewUrl &&
        asset.modelUrl &&
        !attemptedRef.current.has(asset.id),
    );
    if (missing.length === 0) return;

    let cancelled = false;

    const run = async () => {
      for (const asset of missing) {
        if (cancelled) return;
        attemptedRef.current.add(asset.id);

        try {
          await generatePreview(asset);
        } catch (e) {
          console.error(`Preview generation failed for ${asset.id}`, e);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [assets]);

  const searchKey = searchParams.toString();

  const visibleAssets = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    const q = (params.get("q") ?? "").toLowerCase().trim();
    const part = params.get("part");
    const sort = params.get("sort") ?? "asc";

    let rows = [...assets];

    if (part) {
      rows = rows.filter((asset) => asset.part_type === part);
    }

    if (q) {
      rows = rows.filter((asset) => {
        const partLabel = asset.part_type?.replace(/_/g, " ");
        return (
          asset.name.toLowerCase().includes(q) ||
          partLabel?.toLowerCase().includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      const ta = new Date(a.upload_date).getTime();
      const tb = new Date(b.upload_date).getTime();
      return sort === "desc" ? ta - tb : tb - ta;
    });

    return rows;
  }, [assets, searchKey]);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-4 overflow-hidden",
        className,
      )}
    >
      {error && <div className="text-red-500">{error}</div>}
      {!error && assets.length === 0 && <div>No approved assets found.</div>}
      {assets.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <div className="grid grid-cols-4 gap-4">
            {visibleAssets.map((asset) => (
              <Card key={asset.id} className="gap-0 py-4">
                <CardHeader className="px-4 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{asset.name}</CardTitle>

                    {isCommunityView ? (
                      <Button
                        className="cursor-pointer"
                        onClick={() => addToMyLibrary(asset.id)}
                        disabled={copyingAssetId === asset.id}
                      >
                        {copyingAssetId === asset.id
                          ? "Adding..."
                          : "Add to My Library"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="cursor-pointer border-red-600 text-red-600"
                        onClick={() => deleteFromLibrary(asset.id)}
                        disabled={deletingAssetId === asset.id}
                      >
                        {deletingAssetId === asset.id
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="px-4 pt-0">
                  <div className="flex flex-row gap-2">
                    <div className="relative h-80 w-full rounded-md bg-black/20 overflow-hidden">
                      {asset.previewUrl ? (
                        <Image
                          src={asset.previewUrl}
                          alt={`${asset.name} preview`}
                          fill={true}
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No preview
                        </div>
                      )}
                    </div>
                    <div>
                      <CardDescription className="capitalize">
                        {asset.part_type?.replace("_", " ")}
                      </CardDescription>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Uploaded on{" "}
                        {new Date(asset.upload_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
