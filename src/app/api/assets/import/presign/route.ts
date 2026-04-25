import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { userS3Folder } from "@/lib/s3";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";
import { PresignImportBodySchema } from "@/app/api/assets/dto";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  await userS3Folder(auth.user.id);

  const parsed = PresignImportBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const uploadID = crypto.randomUUID();
  const contentType = parsed.data.contentType ?? "model/gltf-binary";
  const objectKey = `users/${auth.user.id}/models/${uploadID}/${parsed.data.filename}`;

  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 60,
  });

  return NextResponse.json(
    { url, objectKey, contentType, uploadID },
    { status: 200 },
  );
}
