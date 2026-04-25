"use client";

import type { PreviewNodeInput } from "@/lib/preview/project";
import { buildWorldTransformsByNodeId } from "@/lib/node-hierarchy";

type NodeLike = {
  id: string;
  parent_id: string | null;
  transforms?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: number;
  } | null;
  asset?: { modelUrl?: string | null } | null;
};

export function toPreviewNodes(nodes: NodeLike[]): PreviewNodeInput[] {
  const worldTransformsById = buildWorldTransformsByNodeId(nodes);
  return nodes
    .filter((node) => !!node.asset?.modelUrl)
    .map((node) => {
      const world = worldTransformsById.get(node.id);
      return {
        modelUrl: node.asset!.modelUrl!,
        position: world?.position ?? { x: 0, y: 0, z: 0 },
        rotation: world?.rotation ?? { x: 0, y: 0, z: 0 },
        scale: world?.scale ?? 1,
      };
    });
}

export async function saveProjectPreview(
  projectId: string,
  nodes: PreviewNodeInput[],
): Promise<{ previewUrl: string | null }> {
  if (!projectId) throw new Error("Missing projectId");
  if (!nodes.length) return { previewUrl: null };

  const { renderProjectPreview } = await import("@/lib/preview/project");
  const previewBlob = await renderProjectPreview(nodes);

  const presignRes = await fetch("/api/projects/preview/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const presignData = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok) {
    throw new Error(presignData?.error ?? "Project preview presign failed");
  }

  const putRes = await fetch(presignData.url, {
    method: "PUT",
    headers: { "Content-Type": presignData.contentType ?? "image/png" },
    body: previewBlob,
  });
  if (!putRes.ok) {
    throw new Error("Project preview upload failed");
  }

  const finalizeRes = await fetch("/api/projects/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      previewObjectKey: presignData.objectKey,
      previewContentType: presignData.contentType ?? "image/png",
      previewBytes: previewBlob.size,
    }),
  });
  const finalizeData = await finalizeRes.json().catch(() => ({}));
  if (!finalizeRes.ok) {
    throw new Error(finalizeData?.error ?? "Project preview finalize failed");
  }

  return { previewUrl: finalizeData.previewUrl ?? null };
}
