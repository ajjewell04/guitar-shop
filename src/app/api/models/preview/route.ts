import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type Body = {
  assetId?: string;
  previewObjectKey?: string;
  previewContentType?: string;
  previewBytes?: number;
};

async function signFileUrl(file?: {
  bucket?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
}) {
  if (!file?.object_key) return null;
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: file.bucket ?? S3_BUCKET,
      Key: file.object_key,
      ResponseContentType: file.mime_type ?? undefined,
    }),
    { expiresIn: 300 },
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  if (!body.assetId || !body.previewObjectKey) {
    return NextResponse.json(
      { error: "Missing assetId/previewObjectKey" },
      { status: 400 },
    );
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, preview_file_id, upload_status")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.upload_status !== "approved") {
    return NextResponse.json(
      { error: "Asset is not approved" },
      { status: 404 },
    );
  }

  if (asset.preview_file_id) {
    return NextResponse.json(
      { error: "Preview already exists" },
      { status: 409 },
    );
  }

  const expectedPrefix = `users/${asset.owner_id}/models/${asset.id}/`;
  if (!body.previewObjectKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid previewObjectKey for asset owner" },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: previewFileError?.message ?? "Preview file insert failed" },
      { status: 400 },
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
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const previewUrl = await signFileUrl(previewFile);
  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
