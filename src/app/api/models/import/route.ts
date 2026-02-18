import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { S3_BUCKET } from "@/lib/s3";

type PartType =
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

type ImportBody = {
  objectKey?: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  assetName?: string;
  partType?: PartType;
  previewObjectKey?: string;
  previewContentType?: string;
  previewBytes?: number;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ImportBody;

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

  if (!body.assetName?.trim() || !body.partType) {
    return NextResponse.json(
      { error: "Missing assetName/partType" },
      { status: 400 },
    );
  }

  if (!body.previewObjectKey) {
    return NextResponse.json(
      { error: "Missing previewObjectKey" },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      name: body.assetName.trim(),
      part_type: body.partType,
      owner_id: user.id,
      upload_date: nowIso,
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
        mime_type: body.contentType ?? "model/gltf-binary",
        bytes: body.bytes,
      },
      {
        asset_id: asset.id,
        owner_id: user.id,
        bucket: S3_BUCKET,
        object_key: body.previewObjectKey,
        file_variant: "preview",
        mime_type: body.previewContentType ?? "image/png",
        bytes: body.previewBytes ?? null,
      },
    ])
    .select("id, file_variant");

  if (fileError || !files?.length) {
    return NextResponse.json(
      { error: fileError?.message ?? "Asset files insert failed" },
      { status: 400 },
    );
  }

  const originalFile = files.find((f) => f.file_variant === "original");
  const previewFile = files.find((f) => f.file_variant === "preview");

  if (!originalFile || !previewFile) {
    return NextResponse.json(
      { error: "Both original and preview files must be inserted" },
      { status: 400 },
    );
  }

  const { data: updated, error: assetUpdateError } = await supabase
    .from("assets")
    .update({
      asset_file_id: originalFile.id,
      preview_file_id: previewFile.id,
      last_updated: nowIso,
    })
    .eq("id", asset.id)
    .select("id, asset_file_id, preview_file_id")
    .single();

  if (assetUpdateError || !updated) {
    return NextResponse.json(
      { error: assetUpdateError?.message ?? "Asset update failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    assetId: asset.id,
    originalFileId: originalFile.id,
    previewFileId: previewFile.id,
  });
}
