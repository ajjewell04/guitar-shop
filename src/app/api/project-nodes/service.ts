import { SupabaseClient } from "@supabase/supabase-js";

type Position = { x: number; y: number; z: number };

export async function getOwnedProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", projectId)
    .single();

  if (error || !data) return { project: null, reason: "not_found" as const };
  if (data.owner_id !== userId)
    return { project: null, reason: "forbidden" as const };

  return { project: data, reason: null };
}

export async function getOwnedAsset(
  supabase: SupabaseClient,
  assetId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, owner_id, name")
    .eq("id", assetId)
    .single();

  if (error || !data) return { asset: null, reason: "not_found" as const };
  if (data.owner_id !== userId)
    return { asset: null, reason: "forbidden" as const };

  return { asset: data, reason: null };
}

export async function getNextSortIndex(
  supabase: SupabaseClient,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("project_nodes")
    .select("sort_index")
    .eq("project_id", projectId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { nextSortIndex: null, error };
  return { nextSortIndex: (data?.sort_index ?? -1) + 1, error: null };
}

export function buildInitialTransforms(): { position: Position } {
  return { position: { x: 0, y: 0, z: 0 } };
}

export function mergePosition(
  transforms: Record<string, unknown> | null,
  position: Position,
) {
  return { ...(transforms ?? {}), position };
}
