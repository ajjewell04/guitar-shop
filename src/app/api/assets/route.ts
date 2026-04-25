import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { deleteObjectsByBucket } from "@/app/api/_shared/s3";
import {
  GetAssetsQuerySchema,
  CreateAssetBodySchema,
  DeleteAssetBodySchema,
} from "@/app/api/assets/dto";
import { mapLibraryAssetRow } from "@/app/api/assets/mappers";
import {
  getOwnedAsset,
  copyAssetToLibrary,
  createAssetFromTemplate,
  TEMPLATE_S3_KEYS,
} from "@/app/api/assets/service";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = GetAssetsQuerySchema.safeParse(query);
  if (!parsed.success) return jsonError("Invalid query params", 400);

  const { ownerId } = parsed.data;
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

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = CreateAssetBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const body = parsed.data;

  if (body.mode === "copy_to_library") {
    if (!body.sourceAssetId) return jsonError("Missing sourceAssetId", 400);
    const { data, error } = await copyAssetToLibrary(
      supabase,
      auth.user.id,
      body.sourceAssetId,
    );
    if (error) return jsonError(error.message, error.status);
    return NextResponse.json(data, { status: 201 });
  }

  const templateKey = body.templateKey;
  if (!templateKey || !(templateKey in TEMPLATE_S3_KEYS)) {
    return jsonError("Invalid templateKey", 400);
  }

  const { data, error } = await createAssetFromTemplate(
    supabase,
    auth.user.id,
    templateKey,
  );
  if (error) return jsonError(error.message, error.status);
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = DeleteAssetBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { asset, reason } = await getOwnedAsset(
    supabase,
    parsed.data.assetId,
    auth.user.id,
  );
  if (!asset) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Asset not found", 404);
  }

  const { data: inUseRows, error: inUseError } = await supabase
    .from("project_nodes")
    .select("id")
    .eq("asset_id", asset.id)
    .limit(1);

  if (inUseError) return jsonError(inUseError.message, 400);
  if ((inUseRows ?? []).length > 0) {
    return jsonError("Asset is used by a project and cannot be deleted", 409);
  }

  const { data: files, error: filesReadError } = await supabase
    .from("asset_files")
    .select("id, owner_id, bucket, object_key")
    .eq("asset_id", asset.id);

  if (filesReadError) return jsonError(filesReadError.message, 400);

  const nowIso = new Date().toISOString();

  const { error: nullRefsError } = await supabase
    .from("assets")
    .update({
      asset_file_id: null,
      preview_file_id: null,
      last_updated: nowIso,
    })
    .eq("id", asset.id)
    .eq("owner_id", auth.user.id);

  if (nullRefsError) return jsonError(nullRefsError.message, 400);

  const { data: deletedFiles, error: deleteFilesError } = await supabase
    .from("asset_files")
    .delete()
    .eq("asset_id", asset.id)
    .eq("owner_id", auth.user.id)
    .select("id");

  if (deleteFilesError) return jsonError(deleteFilesError.message, 400);

  if ((deletedFiles?.length ?? 0) !== (files?.length ?? 0)) {
    return jsonError(
      "Delete blocked by policy: could not delete asset files",
      403,
    );
  }

  const { data: deletedAsset, error: deleteAssetError } = await supabase
    .from("assets")
    .delete()
    .eq("id", asset.id)
    .eq("owner_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (deleteAssetError || !deletedAsset) {
    return jsonError(
      deleteAssetError?.message ??
        "Delete blocked by policy: asset not deleted",
      403,
    );
  }

  if ((files ?? []).length > 0) {
    try {
      await deleteObjectsByBucket(files);
    } catch {
      return NextResponse.json(
        { ok: true, warning: "Asset deleted, but S3 deletion failed" },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
