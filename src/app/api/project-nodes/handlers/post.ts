import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { CreateProjectNodeBodySchema } from "@/app/api/project-nodes/dto";
import {
  buildInitialTransforms,
  getNextSortIndex,
  getOwnedAsset,
  getOwnedProject,
} from "@/app/api/project-nodes/service";

export async function handlePost(req: Request) {
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
