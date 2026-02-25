import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import {
  signGetFileUrl,
  unwrapRelation,
  type S3FileRef,
} from "@/app/api/_shared/s3";
import { GetModelsQuerySchema } from "@/app/api/models/dto";
import { mapLibraryAssetRow } from "@/app/api/models/mappers";

type ProjectModelRow = {
  id: string;
  name: string;
  root_node_id: string | null;
  root_node: {
    id: string;
    name: string;
    transforms: Record<string, unknown> | null;
    asset_id: string | null;
    asset: {
      id: string;
      name: string;
      asset_file_id: string | null;
      preview_file_id: string | null;
      asset_file?: S3FileRef | S3FileRef[] | null;
      preview_file?: S3FileRef | S3FileRef[] | null;
    } | null;
  } | null;
};

export async function handleGet(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = GetModelsQuerySchema.safeParse(query);
  if (!parsed.success) return jsonError("Invalid query params", 400);

  const { projectId, view, ownerId } = parsed.data;

  if (view === "library") {
    if (ownerId && ownerId !== auth.user.id) return jsonError("Forbidden", 403);

    let q = supabase
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
          id,bucket,object_key,mime_type
        ),
        model_file:asset_files!assets_asset_file_id_fkey (
          id,bucket,object_key,mime_type
        )
      `,
      )
      .order("upload_date", { ascending: false });

    q = ownerId ? q.eq("owner_id", ownerId) : q.eq("upload_status", "approved");

    const { data, error } = await q;
    if (error)
      return jsonError(error.message ?? "Failed to retrieve assets", 400);

    const assets = await Promise.all((data ?? []).map(mapLibraryAssetRow));
    return NextResponse.json({ assets }, { status: 200 });
  }

  if (!projectId) return jsonError("Missing projectId", 400);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      root_node_id,
      root_node:project_nodes!projects_root_node_id_fkey (
        id,name,transforms,asset_id,
        asset:assets!project_nodes_asset_id_fkey (
          id,name,asset_file_id,preview_file_id,
          asset_file:asset_files!assets_asset_file_id_fkey (
            id,bucket,object_key,mime_type,bytes,file_variant
          ),
          preview_file:asset_files!assets_preview_file_id_fkey (
            id,bucket,object_key,mime_type,bytes,file_variant
          )
        )
      )
    `,
    )
    .eq("id", projectId)
    .eq("owner_id", auth.user.id)
    .single<ProjectModelRow>();

  if (error || !project)
    return jsonError(error?.message ?? "Project not found", 404);

  const file = unwrapRelation(project.root_node?.asset?.asset_file);
  const previewFile = unwrapRelation(project.root_node?.asset?.preview_file);

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        root_node_id: project.root_node_id,
      },
      root_node: project.root_node ?? null,
      root_asset_file: file ?? null,
      root_preview_file: previewFile ?? null,
      url: await signGetFileUrl(file, { expiresIn: 60 }),
      previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
    },
    { status: 200 },
  );
}
