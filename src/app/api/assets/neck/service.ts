import { supabaseServer } from "@/lib/supabase/server";
import { S3_BUCKET } from "@/lib/s3/client";
import { signPutObjectUrl } from "@/app/api/_shared/s3";
import { normalizeNeckParams, DEFAULT_NECK_PARAMS } from "@/lib/neck/params";
import type { Database } from "@/types/database.types";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

export async function createNeckAsset(db: Db, userId: string, name: string) {
  const now = new Date().toISOString();

  const { data: asset, error: assetError } = await db
    .from("assets")
    .insert({
      owner_id: userId,
      name,
      part_type: "neck",
      upload_status: null,
      upload_date: now,
      last_updated: now,
      meta: { source: "parametric_neck", neck: DEFAULT_NECK_PARAMS },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return {
      data: null,
      error: {
        message: assetError?.message ?? "Create failed",
        status: 400 as const,
      },
    };
  }

  return { data: { assetId: asset.id }, error: null };
}

export async function getNeckPresignUrls(
  db: Db,
  userId: string,
  assetId: string,
) {
  const { data: asset, error } = await db
    .from("assets")
    .select("id, owner_id, part_type")
    .eq("id", assetId)
    .single();

  if (error || !asset)
    return {
      data: null,
      error: { message: "Asset not found", status: 404 as const },
    };
  if (asset.owner_id !== userId)
    return {
      data: null,
      error: { message: "Forbidden", status: 403 as const },
    };
  if (asset.part_type !== "neck")
    return {
      data: null,
      error: { message: "Asset must be neck", status: 400 as const },
    };

  const modelKey = `users/${userId}/models/${asset.id}/generated-neck.glb`;
  const previewKey = `users/${userId}/models/${asset.id}/generated-neck.png`;

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

  return {
    data: {
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
    },
    error: null,
  };
}

export async function saveNeckParams(
  db: Db,
  userId: string,
  args: {
    assetId: string;
    neckParams: Record<string, unknown>;
    modelBytes?: number;
    previewBytes?: number;
  },
) {
  const params = normalizeNeckParams(args.neckParams);

  if (params.headstockAssetId) {
    const { data: headstock } = await db
      .from("assets")
      .select("id, owner_id, part_type")
      .eq("id", params.headstockAssetId)
      .single();

    if (
      !headstock ||
      headstock.owner_id !== userId ||
      headstock.part_type !== "headstock"
    ) {
      return {
        error: { message: "Invalid headstock asset", status: 400 as const },
      };
    }
  }

  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, owner_id, part_type, asset_file_id, preview_file_id")
    .eq("id", args.assetId)
    .single();

  if (assetError || !asset)
    return { error: { message: "Asset not found", status: 404 as const } };
  if (asset.owner_id !== userId)
    return { error: { message: "Forbidden", status: 403 as const } };
  if (asset.part_type !== "neck")
    return { error: { message: "Asset must be neck", status: 400 as const } };

  const modelKey = `users/${userId}/models/${args.assetId}/generated-neck.glb`;
  const previewKey = `users/${userId}/models/${args.assetId}/generated-neck.png`;

  const now = new Date().toISOString();

  const upsertFile = async (
    existingId: string | null,
    fields: {
      object_key: string;
      file_variant: Database["public"]["Enums"]["file_variant"];
      mime_type: string;
      bytes?: number;
    },
  ) => {
    const filename = fields.object_key.split("/").at(-1) ?? null;

    if (existingId) {
      await db
        .from("asset_files")
        .update({
          bucket: S3_BUCKET,
          object_key: fields.object_key,
          filename,
          file_variant: fields.file_variant,
          mime_type: fields.mime_type,
          bytes: fields.bytes ?? null,
          last_updated: now,
        })
        .eq("id", existingId);
      return existingId;
    }
    const { data } = await db
      .from("asset_files")
      .insert({
        asset_id: asset.id,
        owner_id: userId,
        bucket: S3_BUCKET,
        object_key: fields.object_key,
        filename,
        file_variant: fields.file_variant,
        mime_type: fields.mime_type,
        bytes: fields.bytes ?? null,
        created_on: now,
        last_updated: now,
      })
      .select("id")
      .single();
    return data?.id ?? null;
  };

  const [modelFileId, previewFileId] = await Promise.all([
    upsertFile(asset.asset_file_id, {
      object_key: modelKey,
      file_variant: "original",
      mime_type: "model/gltf-binary",
      bytes: args.modelBytes,
    }),
    upsertFile(asset.preview_file_id, {
      object_key: previewKey,
      file_variant: "preview",
      mime_type: "image/png",
      bytes: args.previewBytes,
    }),
  ]);

  if (!modelFileId || !previewFileId) {
    return { error: { message: "File linkage failed", status: 400 as const } };
  }

  const { error: updateError } = await db
    .from("assets")
    .update({
      asset_file_id: modelFileId,
      preview_file_id: previewFileId,
      upload_status: null,
      last_updated: now,
      meta: { source: "parametric_neck", neck: params },
    })
    .eq("id", asset.id);

  if (updateError)
    return { error: { message: updateError.message, status: 400 as const } };
  return { error: null };
}
