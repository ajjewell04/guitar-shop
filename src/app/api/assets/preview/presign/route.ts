import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";
import { PresignModelPreviewBodySchema } from "@/app/api/assets/dto";
import { getOwnedAsset } from "@/app/api/assets/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = PresignModelPreviewBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { asset, reason } = await getOwnedAsset(
    supabase,
    parsed.data.assetId,
    auth.user.id,
  );
  if (!asset) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Asset not found", 404);
  }

  if (asset.upload_status !== "approved")
    return jsonError("Asset is not approved", 400);
  if (asset.preview_file_id) return jsonError("Preview already exists", 409);

  const objectKey = `users/${asset.owner_id}/models/${asset.id}/preview-${crypto.randomUUID()}.png`;
  const contentType = "image/png";

  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 60,
  });

  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
