import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { normalizeNeckParams } from "@/lib/neck-params";
import { buildDefaultNeckMountingFromParams } from "@/lib/mounting";
import { S3_BUCKET } from "@/lib/s3";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.assetId) return jsonError("Missing assetId", 400);

  const params = normalizeNeckParams(body.neckParams);
  if (!params.headstockAssetId)
    return jsonError("headstockAssetId is required", 400);

  const { data: headstock } = await supabase
    .from("assets")
    .select("id, owner_id, part_type")
    .eq("id", params.headstockAssetId)
    .single();

  if (
    !headstock ||
    headstock.owner_id !== auth.user.id ||
    headstock.part_type !== "headstock"
  ) {
    return jsonError("Invalid headstock asset", 400);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, part_type, asset_file_id, preview_file_id")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) return jsonError("Asset not found", 404);
  if (asset.owner_id !== auth.user.id) return jsonError("Forbidden", 403);
  if (asset.part_type !== "neck") return jsonError("Asset must be neck", 400);

  const now = new Date().toISOString();

  const upsertModel = async () => {
    if (asset.asset_file_id) {
      await supabase
        .from("asset_files")
        .update({
          bucket: S3_BUCKET,
          object_key: body.modelObjectKey,
          file_variant: "original",
          mime_type: "model/gltf-binary",
          bytes: body.modelBytes ?? null,
          last_updated: now,
        })
        .eq("id", asset.asset_file_id);
      return asset.asset_file_id;
    }
    const { data } = await supabase
      .from("asset_files")
      .insert({
        asset_id: asset.id,
        owner_id: auth.user.id,
        bucket: S3_BUCKET,
        object_key: body.modelObjectKey,
        file_variant: "original",
        mime_type: "model/gltf-binary",
        bytes: body.modelBytes ?? null,
        created_on: now,
        last_updated: now,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  };

  const upsertPreview = async () => {
    if (asset.preview_file_id) {
      await supabase
        .from("asset_files")
        .update({
          bucket: S3_BUCKET,
          object_key: body.previewObjectKey,
          file_variant: "preview",
          mime_type: "image/png",
          bytes: body.previewBytes ?? null,
          last_updated: now,
        })
        .eq("id", asset.preview_file_id);
      return asset.preview_file_id;
    }
    const { data } = await supabase
      .from("asset_files")
      .insert({
        asset_id: asset.id,
        owner_id: auth.user.id,
        bucket: S3_BUCKET,
        object_key: body.previewObjectKey,
        file_variant: "preview",
        mime_type: "image/png",
        bytes: body.previewBytes ?? null,
        created_on: now,
        last_updated: now,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  };

  const [modelFileId, previewFileId] = await Promise.all([
    upsertModel(),
    upsertPreview(),
  ]);
  if (!modelFileId || !previewFileId)
    return jsonError("File linkage failed", 400);

  const { error: updateError } = await supabase
    .from("assets")
    .update({
      asset_file_id: modelFileId,
      preview_file_id: previewFileId,
      upload_status: null,
      last_updated: now,
      meta: {
        source: "parametric_neck",
        neck: params,
        mounting: buildDefaultNeckMountingFromParams(params),
      },
    })
    .eq("id", asset.id);

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json({ ok: true }, { status: 200 });
}
