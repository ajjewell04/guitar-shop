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
  const view = searchParams.get("view");
  const ownerId = searchParams.get("ownerId");

  if (view === "library") {
    if (ownerId && ownerId !== user.id) {
      return jsonError("Forbidden", 403);
    }

    let query = supabase
      .from("assets")
      .select(
        `
        id,
        name,
        owner_id,
        part_type,
        upload_date,
        upload_status,
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        ),
        model_file:asset_files!assets_asset_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        )
      `,
      )
      .order("upload_date", { ascending: false });

    query = ownerId
      ? query.eq("owner_id", ownerId)
      : query.eq("upload_status", "approved");

    const { data: assets, error } = await query;
    if (error) {
      return jsonError(error.message ?? "Failed to retrieve assets", 400);
    }

    const rows = await Promise.all(
      (assets ?? []).map(async (asset) => {
        const previewFile = unwrapRelation(asset.preview_file);
        const modelFile = unwrapRelation(asset.model_file);

        return {
          id: asset.id,
          name: asset.name,
          owner_id: asset.owner_id,
          part_type: asset.part_type,
          upload_date: asset.upload_date,
          upload_status: asset.upload_status,
          previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
          modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
        };
      }),
    );

    return NextResponse.json({ assets: rows }, { status: 200 });
  }

  if (!projectId) {
    return jsonError("Missing projectId", 400);
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      root_node_id,
      root_node:project_nodes!projects_root_node_id_fkey (
        id,
        name,
        transforms,
        asset_id,
        asset:assets!project_nodes_asset_id_fkey (
          id,
          name,
          asset_file_id,
          preview_file_id,
          asset_file:asset_files!assets_asset_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type,
            bytes,
            file_variant
          ),
          preview_file:asset_files!assets_preview_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type,
            bytes,
            file_variant
          )
        )
      )
    `,
    )
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  if (error || !project) {
    return jsonError(error?.message ?? "Project not found", 404);
  }

  const file = unwrapRelation(project.root_node?.asset?.asset_file);
  const previewFile = unwrapRelation(project.root_node?.asset?.preview_file);

  const url = await signGetFileUrl(file, { expiresIn: 60 });
  const previewUrl = await signGetFileUrl(previewFile, { expiresIn: 60 });

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      root_node_id: project.root_node_id,
    },
    root_node: project.root_node ?? null,
    root_asset_file: file
      ? {
          id: file.id,
          bucket: file.bucket,
          object_key: file.object_key,
          mime_type: file.mime_type,
          bytes: file.bytes,
          file_variant: file.file_variant,
        }
      : null,
    root_preview_file: previewFile
      ? {
          id: previewFile.id,
          bucket: previewFile.bucket,
          object_key: previewFile.object_key,
          mime_type: previewFile.mime_type,
          bytes: previewFile.bytes,
          file_variant: previewFile.file_variant,
        }
      : null,
    url,
    previewUrl,
  });
}
