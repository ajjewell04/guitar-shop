import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type Body = { assetId?: string };

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
  if (!body.assetId) {
    return NextResponse.json({ error: "Misisng assetID" }, { status: 400 });
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, upload_status, preview_file_id")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.upload_status !== "approved") {
    return NextResponse.json(
      { error: "Asset is not approved" },
      { status: 400 },
    );
  }

  if (asset.preview_file_id) {
    return NextResponse.json(
      { error: "Preview already exists" },
      { status: 409 },
    );
  }

  const objectKey = `users/${asset.owner_id}/models/${asset.id}/preview-${crypto.randomUUID()}.png`;
  const contentType = "image/png";

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 60 },
  );
  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
