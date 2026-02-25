import { NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET, userS3Folder } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { unwrapRelation } from "@/app/api/_shared/s3";

type PostBody = {
  mode?: "template" | "copy_to_library";
  templateKey?: keyof typeof TEMPLATE_S3_KEYS;
  sourceAssetId?: string;
};

export const TEMPLATE_S3_KEYS = {
  stratocaster: {
    glb: "templates/stratocaster-template/stratocaster-template.glb",
  },
  telecaster: {
    glb: "templates/telecaster-template/telecaster.glb",
  },
  "les-paul": {
    glb: "templates/lespaul-template/lespaul-template.glb",
  },
} as const;

export function toCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function handlePost(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  await userS3Folder(user.id);

  const body = (await req.json()) as PostBody;

  if (body.mode === "copy_to_library") {
    if (!body.sourceAssetId) return jsonError("Missing sourceAssetId", 400);

    const { data: source, error: sourceError } = await supabase
      .from("assets")
      .select(
        `
        id,
        name,
        owner_id,
        part_type,
        upload_status,
        meta,
        model_file:asset_files!assets_asset_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type,
          bytes
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type,
          bytes
        )
      `,
      )
      .eq("id", body.sourceAssetId)
      .eq("upload_status", "approved")
      .single();

    if (sourceError || !source) {
      return jsonError("Approved source asset not found", 404);
    }

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
        owner_id: user.id,
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
    const copiedModelKey = `users/${user.id}/models/${newAsset.id}/${modelFilename}`;
    const copiedPreviewKey = `users/${user.id}/models/${newAsset.id}/${previewFilename}`;

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

    const { data: copiedFiles, error: copiedFilesError } = await supabase
      .from("asset_files")
      .insert([
        {
          asset_id: newAsset.id,
          owner_id: user.id,
          bucket: S3_BUCKET,
          object_key: copiedModelKey,
          file_variant: "original",
          mime_type: modelFile.mime_type ?? "model/gltf-binary",
          bytes: modelFile.bytes ?? null,
        },
        {
          asset_id: newAsset.id,
          owner_id: user.id,
          bucket: S3_BUCKET,
          object_key: copiedPreviewKey,
          file_variant: "preview",
          mime_type: previewFile.mime_type ?? "image/png",
          bytes: previewFile.bytes ?? null,
        },
      ])
      .select("id, file_variant");

    if (copiedFilesError || !copiedFiles?.length) {
      return jsonError(
        copiedFilesError?.message ?? "Copied asset_files insert failed",
        400,
      );
    }

    const copiedOriginal = copiedFiles.find(
      (f) => f.file_variant === "original",
    );
    const copiedPreview = copiedFiles.find((f) => f.file_variant === "preview");

    if (!copiedOriginal || !copiedPreview) {
      return jsonError(
        "Both copied original and preview files are required",
        400,
      );
    }

    const { error: updateAssetError } = await supabase
      .from("assets")
      .update({
        asset_file_id: copiedOriginal.id,
        preview_file_id: copiedPreview.id,
        last_updated: nowIso,
      })
      .eq("id", newAsset.id);

    if (updateAssetError) return jsonError(updateAssetError.message, 400);

    return NextResponse.json(
      { assetId: newAsset.id, copiedFromAssetId: source.id },
      { status: 201 },
    );
  }

  const template = body.templateKey ? TEMPLATE_S3_KEYS[body.templateKey] : null;
  if (!template?.glb) return jsonError("Invalid templateKey", 400);

  const templateFolder = `users/${user.id}/models/${crypto.randomUUID()}`;
  const glbKey = `${templateFolder}/${body.templateKey}.glb`;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${template.glb}`,
      Key: glbKey,
      ContentType: "model/gltf-binary",
    }),
  );

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      name: `${body.templateKey} template`,
      owner_id: user.id,
      meta: { template: body.templateKey },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return jsonError(assetError?.message ?? "Asset insert failed", 400);
  }

  const { data: files, error: fileError } = await supabase
    .from("asset_files")
    .insert([
      {
        asset_id: asset.id,
        owner_id: user.id,
        bucket: S3_BUCKET,
        object_key: glbKey,
        file_variant: "original",
        mime_type: "model/gltf-binary",
      },
    ])
    .select("id, object_key");

  if (fileError || !files?.length) {
    return jsonError(fileError?.message ?? "Asset files insert failed", 400);
  }

  const primaryFile = files[0];
  const { data: updated, error: assetUpdateError } = await supabase
    .from("assets")
    .update({ asset_file_id: primaryFile.id })
    .eq("id", asset.id)
    .select("id, asset_file_id");

  if (assetUpdateError || !updated?.length) {
    return jsonError(assetUpdateError?.message ?? "Asset update failed", 400);
  }

  return NextResponse.json({ assetId: asset.id, glbKey }, { status: 200 });
}
