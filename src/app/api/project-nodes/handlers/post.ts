import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";

type Position = { x: number; y: number; z: number };

type PostBody = {
  projectId?: string;
  assetId?: string;
  parentId?: string | null;
};

export async function handlePost(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const body = (await req.json().catch(() => null)) as PostBody | null;

  if (!body?.projectId || !body?.assetId) {
    return jsonError("Missing projectId or assetId", 400);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    return jsonError("Project not found", 404);
  }

  if (project.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, name")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return jsonError("Asset not found", 404);
  }

  if (asset.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const { data: maxSortRow, error: maxSortError } = await supabase
    .from("project_nodes")
    .select("sort_index")
    .eq("project_id", body.projectId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxSortError) {
    return jsonError(maxSortError.message, 400);
  }

  const nextSortIndex = (maxSortRow?.sort_index ?? -1) + 1;
  const isRootInsert = !project.root_node_id;

  const { data: insertedNode, error: insertError } = await supabase
    .from("project_nodes")
    .insert({
      project_id: body.projectId,
      type: isRootInsert ? "assembly" : "part",
      parent_id: body.parentId ?? null,
      sort_index: nextSortIndex,
      name: asset.name,
      asset_id: asset.id,
      transforms: { position: { x: 0, y: 0, z: 0 } as Position },
      meta: {},
      overrides: {},
      last_updated: new Date().toISOString(),
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
      .update({
        root_node_id: insertedNode.id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", body.projectId);

    if (updateRootError) {
      return jsonError(updateRootError.message, 400);
    }
  }

  return NextResponse.json({ node: insertedNode }, { status: 201 });
}
