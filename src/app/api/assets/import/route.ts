import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { S3_BUCKET } from "@/lib/s3/client";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { ImportAssetBodySchema } from "@/app/api/assets/dto";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = ImportAssetBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const body = parsed.data;

  const keyPrefix = `users/${auth.user.id}/`;
  if (
    !body.objectKey.startsWith(keyPrefix) ||
    !body.previewObjectKey.startsWith(keyPrefix)
  ) {
    return jsonError("objectKey outside user namespace", 400);
  }

  const nowIso = new Date().toISOString();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      name: body.assetName.trim(),
      part_type: body.partType,
      owner_id: auth.user.id,
      upload_date: nowIso,
      meta: { source: "import" },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return jsonError(assetError?.message ?? "Asset insert failed", 400);
  }

  const { data: files, error: fileError } = await supabase
    .from("asset_files")
    .insert([
      {
        asset_id: asset.id,
        owner_id: auth.user.id,
        bucket: S3_BUCKET,
        object_key: body.objectKey,
        file_variant: "original",
        mime_type: body.contentType ?? "model/gltf-binary",
        bytes: body.bytes ?? null,
      },
      {
        asset_id: asset.id,
        owner_id: auth.user.id,
        bucket: S3_BUCKET,
        object_key: body.previewObjectKey,
        file_variant: "preview",
        mime_type: body.previewContentType ?? "image/png",
        bytes: body.previewBytes ?? null,
      },
    ])
    .select("id, file_variant");

  if (fileError || !files?.length) {
    return jsonError(fileError?.message ?? "Asset files insert failed", 400);
  }

  const originalFile = files.find((f) => f.file_variant === "original");
  const previewFile = files.find((f) => f.file_variant === "preview");

  if (!originalFile || !previewFile) {
    return jsonError("Both original and preview files must be inserted", 400);
  }

  const { data: updated, error: updateError } = await supabase
    .from("assets")
    .update({
      asset_file_id: originalFile.id,
      preview_file_id: previewFile.id,
      last_updated: nowIso,
    })
    .eq("id", asset.id)
    .select("id")
    .single();

  if (updateError || !updated) {
    return jsonError(updateError?.message ?? "Asset update failed", 400);
  }

  return NextResponse.json(
    {
      assetId: asset.id,
      originalFileId: originalFile.id,
      previewFileId: previewFile.id,
    },
    { status: 200 },
  );
}
