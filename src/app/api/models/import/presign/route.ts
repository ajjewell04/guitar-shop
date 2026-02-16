import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";
import { userS3Folder } from "@/lib/s3";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await userS3Folder(user.id);

  const body = (await req.json()) as {
    filename?: string;
    contentType?: string;
  };

  if (!body.filename || !body.filename.toLowerCase().endsWith(".glb")) {
    return NextResponse.json(
      { error: "Only .glb files are supported" },
      { status: 400 },
    );
  }

  const objectKey = `users/${user.id}/models/${crypto.randomUUID()}/${body.filename}`;
  const contentType = body.contentType || "model/gltf-binary";

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 60 },
  );

  return NextResponse.json({ url, objectKey, contentType });
}
