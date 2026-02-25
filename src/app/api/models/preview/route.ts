import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "../../_shared/auth";
import { jsonError } from "../../_shared/http";
import { S3_BUCKET } from "@/lib/s3";
import { signGetFileUrl } from "../../_shared/s3";

type Body = {
  assetId?: string;
  previewObjectKey?: string;
  previewContentType?: string;
  previewBytes?: number;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.assetId || !body.previewObjectKey) {
    return jsonError("Missing assetId/previewObjectKey", 400);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, preview_file_id, upload_status")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return jsonError("Asset not found", 404);
  }

  if (asset.upload_status !== "approved") {
    return jsonError("Asset is not approved", 404);
  }

  if (asset.preview_file_id) {
    return jsonError("Preview already exists", 409);
  }

  const expectedPrefix = `users/${asset.owner_id}/models/${asset.id}/`;
  if (!body.previewObjectKey.startsWith(expectedPrefix)) {
    return jsonError("Invalid previewObjectKey for asset owner", 400);
  }

  const { data: previewFile, error: previewFileError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: asset.id,
      owner_id: asset.owner_id,
      bucket: S3_BUCKET,
      object_key: body.previewObjectKey,
      file_variant: "preview",
      mime_type: body.previewContentType ?? "image/png",
      bytes: body.previewBytes ?? null,
    })
    .select("id, bucket, object_key, mime_type")
    .single();

  if (previewFileError || !previewFile) {
    return jsonError(
      previewFileError?.message ?? "Preview file insert failed",
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

  if (updateError) {
    return jsonError(updateError.message, 400);
  }

  const previewUrl = await signGetFileUrl(previewFile, { expiresIn: 300 });

  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
