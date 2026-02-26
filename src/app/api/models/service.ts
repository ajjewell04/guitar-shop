import { supabaseServer } from "@/lib/supabase";

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

export async function getOwnedProject(
  db: Db,
  projectId: string,
  userId: string,
) {
  const { data, error } = await db
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", projectId)
    .single();

  if (error || !data) return { project: null, reason: "not_found" as const };
  if (data.owner_id !== userId)
    return { project: null, reason: "forbidden" as const };
  return { project: data, reason: null };
}

export function mergePosition(
  transforms: Record<string, unknown> | null,
  position: { x: number; y: number; z: number },
) {
  return { ...(transforms ?? {}), position };
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

export function toCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
