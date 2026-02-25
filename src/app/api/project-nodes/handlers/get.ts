import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signGetFileUrl, unwrapRelation } from "@/app/api/_shared/s3";

export async function handleGet(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return jsonError("Missing projectId", 400);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return jsonError("Project not found", 404);
  }

  if (project.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
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
        model_file:asset_files!assets_asset_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        )
      )
    `,
    )
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true });

  if (nodesError) {
    return jsonError(nodesError.message, 400);
  }

  const { data: libraryAssets, error: assetsError } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      part_type,
      upload_date,
      model_file:asset_files!assets_asset_file_id_fkey (
        id,
        bucket,
        object_key,
        mime_type
      ),
      preview_file:asset_files!assets_preview_file_id_fkey (
        id,
        bucket,
        object_key,
        mime_type
      )
    `,
    )
    .eq("owner_id", user.id)
    .order("upload_date", { ascending: false });

  if (assetsError) {
    return jsonError(assetsError.message, 400);
  }

  const nodeRows = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const modelFile = unwrapRelation(node.asset?.model_file);
      const previewFile = unwrapRelation(node.asset?.preview_file);

      return {
        id: node.id,
        project_id: node.project_id,
        type: node.type,
        parent_id: node.parent_id,
        sort_index: node.sort_index,
        name: node.name,
        asset_id: node.asset_id,
        transforms: node.transforms ?? {},
        last_updated: node.last_updated,
        asset: node.asset
          ? {
              id: node.asset.id,
              name: node.asset.name,
              part_type: node.asset.part_type,
              modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
              previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
            }
          : null,
      };
    }),
  );

  const assetRows = await Promise.all(
    (libraryAssets ?? []).map(async (asset) => {
      const modelFile = unwrapRelation(asset.model_file);
      const previewFile = unwrapRelation(asset.preview_file);

      return {
        id: asset.id,
        name: asset.name,
        part_type: asset.part_type,
        upload_date: asset.upload_date,
        modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
        previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
      };
    }),
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
