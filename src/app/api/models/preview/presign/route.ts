import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";

type Body = { assetId?: string };

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.assetId) {
    return jsonError("Missing assetId", 400);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, upload_status, preview_file_id")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return jsonError("Asset not found", 404);
  }

  if (asset.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  if (asset.upload_status !== "approved") {
    return jsonError("Asset is not approved", 400);
  }

  if (asset.preview_file_id) {
    return jsonError("Preview already exists", 409);
  }

  const objectKey = `users/${asset.owner_id}/models/${asset.id}/preview-${crypto.randomUUID()}.png`;
  const contentType = "image/png";

  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 60,
  });

  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
