import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { deleteObjectsByBucket } from "@/app/api/_shared/s3";
import { DeleteModelBodySchema } from "@/app/api/models/dto";
import { getOwnedAsset } from "@/app/api/models/service";

export async function handleDelete(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = DeleteModelBodySchema.safeParse(
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
