import { NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET, userS3Folder } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { unwrapRelation } from "@/app/api/_shared/s3";
import { CreateModelBodySchema } from "@/app/api/models/dto";
import { TEMPLATE_S3_KEYS, toCopySource } from "@/app/api/models/service";

export async function handlePost(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  await userS3Folder(auth.user.id);

  const parsed = CreateModelBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const body = parsed.data;

  if (body.mode === "copy_to_library") {
    if (!body.sourceAssetId) return jsonError("Missing sourceAssetId", 400);

    const { data: source, error: sourceError } = await supabase
      .from("assets")
      .select(
        `
        id,name,owner_id,part_type,upload_status,meta,
        model_file:asset_files!assets_asset_file_id_fkey (
          id,bucket,object_key,mime_type,bytes
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,bucket,object_key,mime_type,bytes
        )
      `,
      )
      .eq("id", body.sourceAssetId)
      .eq("upload_status", "approved")
      .single();

    if (sourceError || !source)
      return jsonError("Approved source asset not found", 404);

    const modelFile = unwrapRelation(source.model_file);
    const previewFile = unwrapRelation(source.preview_file);

    if (!modelFile?.object_key || !previewFile?.object_key) {
      return jsonError("Source asset is missing model/preview files", 400);
    }

    const nowIso = new Date().toISOString();
    const { data: newAsset, error: newAssetError } = await supabase
      .from("assets")
      .insert({
        name: source.name,
        part_type: source.part_type,
        owner_id: auth.user.id,
        upload_status: null,
        upload_date: nowIso,
        last_updated: nowIso,
        meta: source.meta ?? null,
      })
      .select("id")
      .single();

    if (newAssetError || !newAsset) {
      return jsonError(newAssetError?.message ?? "Asset insert failed", 400);
    }

    const modelFilename = modelFile.object_key.split("/").pop() ?? "model.glb";
    const previewFilename =
      previewFile.object_key.split("/").pop() ?? "preview.png";
    const copiedModelKey = `users/${auth.user.id}/models/${newAsset.id}/${modelFilename}`;
    const copiedPreviewKey = `users/${auth.user.id}/models/${newAsset.id}/${previewFilename}`;

    await Promise.all([
      s3Client.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: toCopySource(
            modelFile.bucket ?? S3_BUCKET,
            modelFile.object_key,
          ),
          Key: copiedModelKey,
        }),
      ),
      s3Client.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: toCopySource(
            previewFile.bucket ?? S3_BUCKET,
            previewFile.object_key,
          ),
          Key: copiedPreviewKey,
        }),
      ),
    ]);

    return NextResponse.json(
      { assetId: newAsset.id, copiedFromAssetId: source.id },
      { status: 201 },
    );
  }

  const template = body.templateKey ? TEMPLATE_S3_KEYS[body.templateKey] : null;
  if (!template?.glb) return jsonError("Invalid templateKey", 400);

  const nowIso = new Date().toISOString();

  const { data: newAsset, error: newAssetError } = await supabase
    .from("assets")
    .insert({
      name: template.name,
      owner_id: auth.user.id,
      upload_status: null,
      upload_date: nowIso,
      last_updated: nowIso,
      meta: { source: "template", templateKey: body.templateKey },
    })
    .select("id")
    .single();

  if (newAssetError || !newAsset) {
    return jsonError(
      newAssetError?.message ?? "Template asset insert failed",
      400,
    );
  }

  const folder = `users/${auth.user.id}/models/${newAsset.id}`;
  const glbKey = `${folder}/${body.templateKey}.glb`;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: toCopySource(S3_BUCKET, template.glb),
      Key: glbKey,
      ContentType: "model/gltf-binary",
    }),
  );

  const { data: modelFile, error: modelFileError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: newAsset.id,
      owner_id: auth.user.id,
      file_variant: "original",
      bucket: S3_BUCKET,
      object_key: glbKey,
      filename: `${body.templateKey}.glb`,
      mime_type: "model/gltf-binary",
    })
    .select("id")
    .single();

  if (modelFileError || !modelFile) {
    return jsonError(
      modelFileError?.message ?? "Template model file insert failed",
      400,
    );
  }

  const { error: updateAssetError } = await supabase
    .from("assets")
    .update({
      asset_file_id: modelFile.id,
      last_updated: nowIso,
    })
    .eq("id", newAsset.id);

  if (updateAssetError) {
    return jsonError(
      updateAssetError.message ?? "Template asset update failed",
      400,
    );
  }

  return NextResponse.json(
    { assetId: newAsset.id, modelFileId: modelFile.id },
    { status: 201 },
  );
}
