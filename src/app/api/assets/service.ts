import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/s3/client";
import { userS3Folder } from "@/lib/s3/folder";
import { supabaseServer } from "@/lib/supabase/server";
import { unwrapRelation } from "@/app/api/_shared/s3";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

export async function getOwnedAsset(db: Db, assetId: string, userId: string) {
  const { data, error } = await db
    .from("assets")
    .select("id, owner_id, asset_file_id, preview_file_id, upload_status")
    .eq("id", assetId)
    .single();

  if (error || !data) return { asset: null, reason: "not_found" as const };
  if (data.owner_id !== userId)
    return { asset: null, reason: "forbidden" as const };
  return { asset: data, reason: null };
}

export const TEMPLATE_S3_KEYS = {
  stratocaster: {
    glb: "templates/stratocaster-template/stratocaster-template.glb",
    preview: "templates/stratocaster-template/preview.png",
  },
  telecaster: {
    glb: "templates/telecaster-template/telecaster.glb",
    preview: "templates/telecaster-template/preview.png",
  },
  "les-paul": {
    glb: "templates/lespaul-template/lespaul-template.glb",
    preview: "templates/lespaul-template/preview.png",
  },
} as const;

function toCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function copyAssetToLibrary(
  db: Db,
  userId: string,
  sourceAssetId: string,
) {
  await userS3Folder(userId);

  const { data: source, error: sourceError } = await db
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
    .eq("id", sourceAssetId)
    .eq("upload_status", "approved")
    .single();

  if (sourceError || !source) {
    return {
      data: null,
      error: {
        message: "Approved source asset not found",
        status: 404 as const,
      },
    };
  }

  const modelFile = unwrapRelation(source.model_file);
  const previewFile = unwrapRelation(source.preview_file);

  if (!modelFile?.object_key || !previewFile?.object_key) {
    return {
      data: null,
      error: {
        message: "Source asset is missing model/preview files",
        status: 400 as const,
      },
    };
  }

  const nowIso = new Date().toISOString();
  const { data: newAsset, error: newAssetError } = await db
    .from("assets")
    .insert({
      name: source.name,
      part_type: source.part_type,
      owner_id: userId,
      upload_status: null,
      upload_date: nowIso,
      last_updated: nowIso,
      meta: source.meta ?? null,
    })
    .select("id")
    .single();

  if (newAssetError || !newAsset) {
    return {
      data: null,
      error: {
        message: newAssetError?.message ?? "Asset insert failed",
        status: 400 as const,
      },
    };
  }

  const modelFilename = modelFile.object_key.split("/").pop() ?? "model.glb";
  const previewFilename =
    previewFile.object_key.split("/").pop() ?? "preview.png";
  const copiedModelKey = `users/${userId}/models/${newAsset.id}/${modelFilename}`;
  const copiedPreviewKey = `users/${userId}/models/${newAsset.id}/${previewFilename}`;

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

  return {
    data: { assetId: newAsset.id, copiedFromAssetId: source.id },
    error: null,
  };
}

export async function createAssetFromTemplate(
  db: Db,
  userId: string,
  templateKey: keyof typeof TEMPLATE_S3_KEYS,
) {
  await userS3Folder(userId);

  const template = TEMPLATE_S3_KEYS[templateKey];
  const nowIso = new Date().toISOString();

  const { data: newAsset, error: newAssetError } = await db
    .from("assets")
    .insert({
      name: `${templateKey} template`,
      owner_id: userId,
      upload_status: null,
      upload_date: nowIso,
      last_updated: nowIso,
      meta: { source: "template", templateKey },
    })
    .select("id")
    .single();

  if (newAssetError || !newAsset) {
    return {
      data: null,
      error: {
        message: newAssetError?.message ?? "Template asset insert failed",
        status: 400 as const,
      },
    };
  }

  const folder = `users/${userId}/models/${crypto.randomUUID()}`;
  const modelFilename = template.glb.split("/").pop() ?? `${templateKey}.glb`;
  const previewFilename = template.preview.split("/").pop() ?? "preview.png";
  const copiedModelKey = `${folder}/${modelFilename}`;
  const copiedPreviewKey = `${folder}/${previewFilename}`;

  await Promise.all([
    s3Client.send(
      new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: toCopySource(S3_BUCKET, template.glb),
        Key: copiedModelKey,
        ContentType: "model/gltf-binary",
      }),
    ),
    s3Client.send(
      new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: toCopySource(S3_BUCKET, template.preview),
        Key: copiedPreviewKey,
        ContentType: "image/png",
      }),
    ),
  ]);

  const { data: modelFile, error: modelFileError } = await db
    .from("asset_files")
    .insert({
      asset_id: newAsset.id,
      owner_id: userId,
      file_variant: "original",
      bucket: S3_BUCKET,
      object_key: copiedModelKey,
      mime_type: "model/gltf-binary",
    })
    .select("id")
    .single();

  if (modelFileError || !modelFile) {
    return {
      data: null,
      error: {
        message: modelFileError?.message ?? "Model file record insert failed",
        status: 400 as const,
      },
    };
  }

  const { data: previewFile, error: previewFileError } = await db
    .from("asset_files")
    .insert({
      asset_id: newAsset.id,
      owner_id: userId,
      file_variant: "preview",
      bucket: S3_BUCKET,
      object_key: copiedPreviewKey,
      mime_type: "image/png",
    })
    .select("id")
    .single();

  if (previewFileError || !previewFile) {
    return {
      data: null,
      error: {
        message:
          previewFileError?.message ?? "Preview file record insert failed",
        status: 400 as const,
      },
    };
  }

  const { error: updateAssetError } = await db
    .from("assets")
    .update({
      asset_file_id: modelFile.id,
      preview_file_id: previewFile.id,
      last_updated: nowIso,
    })
    .eq("id", newAsset.id)
    .eq("owner_id", userId);

  if (updateAssetError) {
    return {
      data: null,
      error: {
        message: updateAssetError.message ?? "Asset file linkage failed",
        status: 400 as const,
      },
    };
  }

  return { data: { assetId: newAsset.id }, error: null };
}
