import { createClient } from "@/lib/server";
import { supabaseServer } from "@/lib/supabase";
import { S3_BUCKET } from "@/lib/s3";

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | Awaited<ReturnType<typeof supabaseServer>>;

export async function getOwnedProject(
  db: DbClient,
  projectId: string,
  userId: string,
) {
  const { data, error } = await db
    .from("projects")
    .select("id, owner_id, root_node_id, preview_file_id")
    .eq("id", projectId)
    .single<{
      id: string;
      owner_id: string;
      root_node_id: string | null;
      preview_file_id: string | null;
    }>();

  if (error || !data) return { project: null, reason: "not_found" as const };
  if (data.owner_id !== userId)
    return { project: null, reason: "forbidden" as const };
  return { project: data, reason: null };
}

export async function createProjectWithRoot(db: DbClient, name: string) {
  return db
    .rpc("create_project_with_root", { p_name: name })
    .single<{ project_id: string; root_node_id: string }>();
}

export async function promoteProjectRoot(
  db: DbClient,
  args: { projectId: string; newRootNodeId: string },
) {
  return db
    .rpc("promote_project_root", {
      p_project_id: args.projectId,
      p_new_root_node_id: args.newRootNodeId,
    })
    .single<{ project_id: string; root_node_id: string }>();
}

export async function assignRootAsset(
  db: DbClient,
  rootNodeId: string,
  assetId: string,
) {
  return db
    .from("project_nodes")
    .update({ asset_id: assetId })
    .eq("id", rootNodeId);
}

export async function upsertProjectPreviewFile(
  db: DbClient,
  args: {
    existingPreviewFileId: string | null;
    userId: string;
    objectKey: string;
    mimeType: string;
    bytes: number | null;
    nowIso: string;
  },
) {
  if (args.existingPreviewFileId) {
    return db
      .from("asset_files")
      .update({
        bucket: S3_BUCKET,
        object_key: args.objectKey,
        mime_type: args.mimeType,
        bytes: args.bytes,
        last_updated: args.nowIso,
      })
      .eq("id", args.existingPreviewFileId)
      .eq("owner_id", args.userId)
      .select("id, bucket, object_key, mime_type")
      .maybeSingle();
  }

  return db
    .from("asset_files")
    .insert({
      asset_id: null,
      owner_id: args.userId,
      file_variant: "preview",
      bucket: S3_BUCKET,
      object_key: args.objectKey,
      mime_type: args.mimeType,
      bytes: args.bytes,
    })
    .select("id, bucket, object_key, mime_type")
    .single();
}

export async function attachProjectPreview(
  db: DbClient,
  args: { projectId: string; userId: string; fileId: string; nowIso: string },
) {
  return db
    .from("projects")
    .update({ preview_file_id: args.fileId, last_updated: args.nowIso })
    .eq("id", args.projectId)
    .eq("owner_id", args.userId)
    .select("id, preview_file_id")
    .maybeSingle();
}
