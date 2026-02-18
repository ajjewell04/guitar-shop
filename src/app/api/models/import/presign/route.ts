import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET, userS3Folder } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type PresignBody = {
  filename?: string;
  contentType?: string;
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

  await userS3Folder(user.id);

  const body = (await req.json()) as PresignBody;
  const uploadID = crypto.randomUUID();
  const filename = body.filename;

  if (!filename) {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  const contentType = body.contentType || "model/gltf-binary";
  const objectKey = `users/${user.id}/models/${uploadID}/${filename}`;

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 60 },
  );

  return NextResponse.json({
    url,
    objectKey,
    contentType,
    uploadID,
  });
}
