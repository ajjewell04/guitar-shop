import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => null);
  if (!body?.assetId) return jsonError("Missing assetId", 400);

  const { data: asset, error } = await supabase
    .from("assets")
    .select("id, owner_id, part_type")
    .eq("id", body.assetId)
    .single();

  if (error || !asset) return jsonError("Asset not found", 404);
  if (asset.owner_id !== auth.user.id) return jsonError("Forbidden", 403);
  if (asset.part_type !== "neck") return jsonError("Asset must be neck", 400);

  const modelKey = `users/${auth.user.id}/models/${asset.id}/generated-neck.glb`;
  const previewKey = `users/${auth.user.id}/models/${asset.id}/generated-neck.png`;

  const [modelUrl, previewUrl] = await Promise.all([
    signPutObjectUrl({
      objectKey: modelKey,
      contentType: "model/gltf-binary",
      expiresIn: 300,
    }),
    signPutObjectUrl({
      objectKey: previewKey,
      contentType: "image/png",
      expiresIn: 300,
    }),
  ]);

  return NextResponse.json({
    model: {
      url: modelUrl,
      objectKey: modelKey,
      contentType: "model/gltf-binary",
    },
    preview: {
      url: previewUrl,
      objectKey: previewKey,
      contentType: "image/png",
    },
  });
}
