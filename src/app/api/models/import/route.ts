import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { S3_BUCKET } from "@/lib/s3";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    objectKey?: string;
    filename?: string;
    contentType?: string;
    bytes?: number;
    assetName?: string;
    partType?:
      | "body"
      | "neck"
      | "headstock"
      | "bridge"
      | "tuning_machine"
      | "pickup"
      | "pickguard"
      | "knob"
      | "switch"
      | "strap_button"
      | "output_jack"
      | "miscellaneous";
  };

  if (!body.objectKey || !body.filename) {
    return NextResponse.json(
      { error: "Missing objectKey/filename" },
      { status: 400 },
    );
  }

  if (!body.assetName?.trim() || !body.partType) {
    return NextResponse.json(
      { error: "Missing assetName/partType" },
      { status: 400 },
    );
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      name: body.assetName.trim(),
      type: "model",
      part_type: body.partType,
      scope: "project",
      owner_id: user.id,
      meta: { source: "import" },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return NextResponse.json(
      { error: assetError?.message ?? "Asset insert failed" },
      { status: 400 },
    );
  }

  const { data: files, error: fileError } = await supabase
    .from("asset_files")
    .insert([
      {
        asset_id: asset.id,
        owner_id: user.id,
        bucket: S3_BUCKET,
        object_key: body.objectKey,
        file_variant: "original",
        mime_type: body.contentType || "model/gltf-binary",
        bytes: body.bytes ?? null,
      },
    ])
    .select("id");

  if (fileError || !files?.length) {
    return NextResponse.json(
      { error: fileError?.message ?? "Asset files insert failed" },
      { status: 400 },
    );
  }

  const primaryFile = files[0];

  const { data: updated, error: assetUpdateError } = await supabase
    .from("assets")
    .update({ asset_file_id: primaryFile.id })
    .eq("id", asset.id)
    .select("id, asset_file_id");

  if (assetUpdateError || !updated?.length) {
    return NextResponse.json(
      { error: assetUpdateError?.message ?? "Asset update failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ assetId: asset.id });
}
