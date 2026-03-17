import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { DEFAULT_NECK_PARAMS } from "@/lib/neck-params";
import { buildDefaultNeckMountingFromParams } from "@/lib/mounting";
import { S3_BUCKET } from "@/lib/s3";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Parametric Neck";

  const now = new Date().toISOString();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      owner_id: auth.user.id,
      name,
      part_type: "neck",
      upload_status: null,
      upload_date: now,
      last_updated: now,
      meta: {
        source: "parametric_neck",
        neck: DEFAULT_NECK_PARAMS,
        mounting: buildDefaultNeckMountingFromParams(DEFAULT_NECK_PARAMS),
      },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return jsonError(assetError?.message ?? "Create failed", 400);
  }

  const { data: modelFile, error: modelFileError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: asset.id,
      owner_id: auth.user.id,
      file_variant: "original",
      bucket: S3_BUCKET,
      object_key: null,
      mime_type: "model/gltf-binary",
      bytes: null,
    })
    .select("id")
    .single();

  if (modelFileError || !modelFile) {
    await supabase
      .from("assets")
      .delete()
      .eq("id", asset.id)
      .eq("owner_id", auth.user.id);

    return jsonError(
      modelFileError?.message ?? "Failed to create associated asset_file",
      400,
    );
  }

  const { error: linkError } = await supabase
    .from("assets")
    .update({
      asset_file_id: modelFile.id,
      last_updated: now,
    })
    .eq("id", asset.id)
    .eq("owner_id", auth.user.id);

  if (linkError) {
    await supabase.from("asset_files").delete().eq("id", modelFile.id);
    await supabase
      .from("assets")
      .delete()
      .eq("id", asset.id)
      .eq("owner_id", auth.user.id);

    return jsonError(linkError.message ?? "Failed to link asset_file", 400);
  }

  return NextResponse.json(
    { assetId: asset.id, assetFileId: modelFile.id },
    { status: 201 },
  );
}
