import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { userS3Folder } from "@/lib/s3";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";

type PresignBody = {
  filename?: string;
  contentType?: string;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  await userS3Folder(user.id);

  const body = (await req.json().catch(() => null)) as PresignBody | null;
  const filename = body?.filename;

  if (!filename) {
    return jsonError("Missing filename", 400);
  }

  const uploadID = crypto.randomUUID();
  const contentType = body?.contentType || "model/gltf-binary";
  const objectKey = `users/${user.id}/models/${uploadID}/${filename}`;

  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 60,
  });

  return NextResponse.json({
    url,
    objectKey,
    contentType,
    uploadID,
  });
}
