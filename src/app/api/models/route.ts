import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  console.log("User:", user?.id, "Error:", userError);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assets, error } = await supabase
    .from("assets")
    .select(
      `
      id, owner_id, name, type, asset_file_id,
      asset_file:asset_files!asset_file_asset_id_fkey (
      id, file_variant, bucket, object_key, mime_type, bytes, created_on, last_updated
        )
    `,
    )
    .eq("owner_id", user.id)
    .eq("type", "model");

  console.log("Assets:", assets, "Error:", error);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    assets.map(async (asset) => {
      const file = asset.asset_file?.[0];
      if (!file?.object_key) return asset;
      const url = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: file.object_key,
          ResponseContentType: file.mime_type ?? undefined,
        }),
        { expiresIn: 60 },
      );
      return {
        id: asset.id,
        name: asset.name,
        file: {
          id: asset.asset_file_id.id,
          key: asset.asset_file_id.object_key,
          mime: asset.asset_file_id.mime_type,
          size: asset.asset_file_id.bytes,
        },
        url,
      };
    }),
  );

  console.log("Results:", results);
  return NextResponse.json({ models: results, assets: assets });
}
