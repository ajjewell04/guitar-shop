import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { deleteObjectsByBucket } from "@/app/api/_shared/s3";

type DeleteBody = {
  assetId?: string;
};

export async function handleDelete(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const body = (await req.json().catch(() => null)) as DeleteBody | null;

  if (!body?.assetId) return jsonError("Missing assetId", 400);

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, asset_file_id, preview_file_id")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) return jsonError("Asset not found", 404);
  if (asset.owner_id !== user.id) return jsonError("Forbidden", 403);

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

  const { error: nullRefsError } = await supabase
    .from("assets")
    .update({
      asset_file_id: null,
      preview_file_id: null,
      last_updated: new Date().toISOString(),
    })
    .eq("id", asset.id)
    .eq("owner_id", user.id);

  if (nullRefsError) return jsonError(nullRefsError.message, 400);

  const { data: deletedFiles, error: deleteFilesError } = await supabase
    .from("asset_files")
    .delete()
    .eq("asset_id", asset.id)
    .eq("owner_id", user.id)
    .select("id");

  if (deleteFilesError) {
    await supabase
      .from("assets")
      .update({
        asset_file_id: asset.asset_file_id,
        preview_file_id: asset.preview_file_id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .eq("owner_id", user.id);

    return jsonError(deleteFilesError.message, 400);
  }

  const expectedFileCount = files?.length ?? 0;
  const actualDeletedFileCount = deletedFiles?.length ?? 0;

  if (actualDeletedFileCount !== expectedFileCount) {
    await supabase
      .from("assets")
      .update({
        asset_file_id: asset.asset_file_id,
        preview_file_id: asset.preview_file_id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .eq("owner_id", user.id);

    return jsonError(
      "Delete blocked by policy: could not delete asset files",
      403,
    );
  }

  const { data: deletedAsset, error: deleteAssetError } = await supabase
    .from("assets")
    .delete()
    .eq("id", asset.id)
    .eq("owner_id", user.id)
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
