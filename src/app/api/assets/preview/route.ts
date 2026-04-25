import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "../../_shared/auth";
import { jsonError } from "../../_shared/http";
import { S3_BUCKET } from "@/lib/s3";
import { signGetFileUrl } from "../../_shared/s3";
import { UpdateModelPreviewBodySchema } from "@/app/api/assets/dto";
import { getOwnedAsset } from "@/app/api/assets/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = UpdateModelPreviewBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { assetId, previewObjectKey, previewContentType, previewBytes } =
    parsed.data;

  const { asset, reason } = await getOwnedAsset(
    supabase,
    assetId,
    auth.user.id,
  );
  if (!asset) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Asset not found", 404);
  }

  if (asset.upload_status !== "approved")
    return jsonError("Asset is not approved", 400);
  if (asset.preview_file_id) return jsonError("Preview already exists", 409);

  const expectedPrefix = `users/${asset.owner_id}/models/${asset.id}/`;
  if (!previewObjectKey.startsWith(expectedPrefix)) {
    return jsonError("Invalid previewObjectKey for asset owner", 400);
  }

  const { data: previewFile, error: previewError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: asset.id,
      owner_id: asset.owner_id,
      bucket: S3_BUCKET,
      object_key: previewObjectKey,
      file_variant: "preview",
      mime_type: previewContentType ?? "image/png",
      bytes: previewBytes ?? null,
    })
    .select("id, bucket, object_key, mime_type")
    .single();

  if (previewError || !previewFile) {
    return jsonError(
      previewError?.message ?? "Preview file insert failed",
      400,
    );
  }

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      preview_file_id: previewFile.id,
      last_updated: new Date().toISOString(),
    })
    .eq("id", asset.id)
    .is("preview_file_id", null);

  if (updateError) return jsonError(updateError.message, 400);

  const previewUrl = await signGetFileUrl(previewFile, { expiresIn: 300 });
  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
