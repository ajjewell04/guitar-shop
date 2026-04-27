import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { unwrapRelation } from "@/app/api/_shared/s3";
import {
  GetProjectNodesQuerySchema,
  CreateProjectNodeBodySchema,
  DeleteProjectNodeBodySchema,
  PatchProjectNodeBodySchema,
} from "@/app/api/projects/nodes/dto";
import {
  mapLibraryAssetRow,
  mapNodeRow,
} from "@/app/api/projects/nodes/mappers";
import {
  getOwnedProject,
  getOwnedAsset,
  getNextSortIndex,
  buildInitialTransforms,
  mergeTransforms,
} from "@/app/api/projects/nodes/service";
type NodeAsset = NonNullable<Parameters<typeof mapNodeRow>[0]["asset"]>;

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = GetProjectNodesQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );

  if (!parse.success) return jsonError("Missing or invalid projectId", 400);

  const { project, reason } = await getOwnedProject(
    supabase,
    parse.data.projectId,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  const { data: nodes, error: nodesError } = await supabase
    .from("project_nodes")
    .select(
      `
      id,
      project_id,
      type,
      parent_id,
      sort_index,
      name,
      asset_id,
      transforms,
      last_updated,
      asset:assets!project_nodes_asset_id_fkey (
        id,
        name,
        part_type,
        meta,
        model_file:asset_files!assets_asset_file_id_fkey (
          id, bucket, object_key, mime_type
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id, bucket, object_key, mime_type
        )
      )
    `,
    )
    .eq("project_id", parse.data.projectId)
    .order("sort_index", { ascending: true });

  if (nodesError) return jsonError(nodesError.message, 400);

  const { data: libraryAssets, error: assetsError } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      part_type,
      meta,
      upload_date,
      model_file:asset_files!assets_asset_file_id_fkey (
        id, bucket, object_key, mime_type
      ),
      preview_file:asset_files!assets_preview_file_id_fkey (
        id, bucket, object_key, mime_type
      )
    `,
    )
    .eq("owner_id", auth.user.id)
    .order("upload_date", { ascending: false });

  if (assetsError) return jsonError(assetsError.message, 400);

  const nodeRows = await Promise.all(
    (nodes ?? []).map((node) =>
      mapNodeRow({
        ...node,
        asset: unwrapRelation<NodeAsset>(
          node.asset as NodeAsset | NodeAsset[] | null | undefined,
        ),
      }),
    ),
  );

  const assetRows = await Promise.all(
    (libraryAssets ?? []).map(mapLibraryAssetRow),
  );

  return NextResponse.json(
    {
      project: {
        id: project.id,
        root_node_id: project.root_node_id,
      },
      nodes: nodeRows,
      libraryAssets: assetRows,
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = CreateProjectNodeBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parse.success) return jsonError("Invalid request body", 400);

  const { projectId, assetId, parentId } = parse.data;

  const { project, reason: projectReason } = await getOwnedProject(
    supabase,
    projectId,
    auth.user.id,
  );

  if (!project) {
    return projectReason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

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

  const { nextSortIndex, error: sortError } = await getNextSortIndex(
    supabase,
    projectId,
  );
  if (sortError || nextSortIndex === null) {
    return jsonError(sortError?.message ?? "Failed to load sort index", 400);
  }

  const isRootInsert = !project.root_node_id;
  const now = new Date().toISOString();

  const { data: insertedNode, error: insertError } = await supabase
    .from("project_nodes")
    .insert({
      project_id: projectId,
      type: isRootInsert ? "assembly" : "part",
      parent_id: parentId ?? null,
      sort_index: nextSortIndex,
      name: asset.name,
      asset_id: asset.id,
      transforms: buildInitialTransforms(),
      meta: {},
      overrides: {},
      last_updated: now,
    })
    .select(
      "id, project_id, type, parent_id, sort_index, name, asset_id, transforms",
    )
    .single();

  if (insertError || !insertedNode) {
    return jsonError(insertError?.message ?? "Failed to create node", 400);
  }

  if (isRootInsert) {
    const { error: updateRootError } = await supabase
      .from("projects")
      .update({ root_node_id: insertedNode.id, last_updated: now })
      .eq("id", projectId);

    if (updateRootError) return jsonError(updateRootError.message, 400);
  }

  return NextResponse.json({ node: insertedNode }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = DeleteProjectNodeBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parse.success) return jsonError("Invalid request body", 400);

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id")
    .eq("id", parse.data.nodeId)
    .single<{ id: string; project_id: string }>();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { project, reason } = await getOwnedProject(
    supabase,
    node.project_id,
    auth.user.id,
  );
  if (!project || reason === "forbidden") return jsonError("Forbidden", 403);

  const { data: childRows, error: childError } = await supabase
    .from("project_nodes")
    .select("id")
    .eq("project_id", node.project_id)
    .eq("parent_id", node.id)
    .limit(1);

  if (childError) return jsonError(childError.message, 400);
  if ((childRows ?? []).length > 0) {
    return jsonError("Cannot delete a node that has children.", 409);
  }

  const nowIso = new Date().toISOString();

  if (project.root_node_id === node.id) {
    const { error: clearRootError } = await supabase
      .from("project_nodes")
      .update({
        asset_id: null,
        last_updated: nowIso,
      })
      .eq("id", node.id);

    if (clearRootError) return jsonError(clearRootError.message, 400);

    return NextResponse.json({ ok: true, rootCleared: true }, { status: 200 });
  }

  const { error: deleteError } = await supabase
    .from("project_nodes")
    .delete()
    .eq("id", node.id)
    .eq("project_id", node.project_id);

  if (deleteError) return jsonError(deleteError.message, 400);

  return NextResponse.json(
    { ok: true, deletedNodeId: node.id },
    { status: 200 },
  );
}

export async function PATCH(req: Request) {
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

  let nextAssetId = node.asset_id;
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
