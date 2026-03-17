import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { PatchProjectNodeBodySchema } from "@/app/api/project-nodes/dto";
import {
  getOwnedAsset,
  getOwnedProject,
  mergeTransforms,
} from "@/app/api/project-nodes/service";

export async function handlePatch(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = PatchProjectNodeBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parse.success) return jsonError("Invalid request body", 400);

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id, parent_id, asset_id, transforms")
    .eq("id", parse.data.nodeId)
    .single();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { project, reason } = await getOwnedProject(
    supabase,
    node.project_id,
    auth.user.id,
  );

  if (!project || reason === "forbidden") return jsonError("Forbidden", 403);

  const { parentId, assetId } = parse.data;

  if (parentId !== undefined && project.root_node_id === node.id) {
    return jsonError("Root node cannot be reparented", 400);
  }

  if (parentId !== undefined && parentId === node.id) {
    return jsonError("Node cannot be its own parent", 400);
  }

  if (parentId !== undefined && parentId !== null) {
    const { data: parentNode, error: parentError } = await supabase
      .from("project_nodes")
      .select("id, project_id")
      .eq("id", parentId)
      .single();

    if (parentError || !parentNode) {
      return jsonError("Parent node not found", 404);
    }
    if (parentNode.project_id !== node.project_id) {
      return jsonError("Parent node must be in the same project", 400);
    }

    const { data: projectNodes, error: graphError } = await supabase
      .from("project_nodes")
      .select("id, parent_id")
      .eq("project_id", node.project_id);

    if (graphError) return jsonError(graphError.message, 400);

    const parentById = new Map<string, string | null>();
    for (const projectNode of projectNodes ?? []) {
      parentById.set(projectNode.id, projectNode.parent_id ?? null);
    }
    parentById.set(node.id, parentId);

    const seen = new Set<string>();
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === node.id) {
        return jsonError("Parent assignment creates a cycle", 400);
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
  }

  let nextAssetId = node.asset_id as string | null;
  let nextName: string | null = null;
  if (assetId !== undefined) {
    const { asset, reason: assetReason } = await getOwnedAsset(
      supabase,
      assetId,
      auth.user.id,
    );
    if (!asset) {
      return assetReason === "forbidden"
        ? jsonError("Forbidden", 403)
        : jsonError("Asset not found", 404);
    }
    nextAssetId = asset.id;
    nextName = asset.name;
  }

  const nextTransforms = mergeTransforms(node.transforms, {
    position: parse.data.position,
    rotation: parse.data.rotation,
    scale: parse.data.scale,
  });

  const patch: Record<string, unknown> = {
    transforms: nextTransforms,
    last_updated: new Date().toISOString(),
  };
  if (parentId !== undefined) patch.parent_id = parentId;
  if (assetId !== undefined) {
    patch.asset_id = nextAssetId;
    if (nextName) patch.name = nextName;
  }

  const { error: updateError } = await supabase
    .from("project_nodes")
    .update(patch)
    .eq("id", parse.data.nodeId);

  if (updateError) return jsonError(updateError.message, 400);

  return NextResponse.json(
    {
      ok: true,
      transforms: nextTransforms,
      parent_id: parentId !== undefined ? parentId : node.parent_id,
      asset_id: nextAssetId,
    },
    { status: 200 },
  );
}
