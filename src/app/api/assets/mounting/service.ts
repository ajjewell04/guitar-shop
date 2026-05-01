import type { supabaseServer } from "@/lib/supabase/server";
import type { GuitarMeta } from "@/lib/guitar/schema";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

const KIND_TO_PART_TYPE: Record<GuitarMeta["kind"], string> = {
  body: "body",
  bridge: "bridge",
  pickup: "pickup",
};

export async function saveMounting(
  db: Db,
  userId: string,
  args: { assetId: string; guitar: GuitarMeta },
): Promise<{ error: { message: string; status: 404 | 403 | 400 } | null }> {
  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("id, owner_id, part_type, meta")
    .eq("id", args.assetId)
    .single();

  if (assetError || !asset)
    return { error: { message: "Asset not found", status: 404 } };
  if (asset.owner_id !== userId)
    return { error: { message: "Forbidden", status: 403 } };

  const expectedPartType = KIND_TO_PART_TYPE[args.guitar.kind];
  if (asset.part_type !== expectedPartType)
    return {
      error: {
        message: `guitar.kind "${args.guitar.kind}" does not match asset part_type "${asset.part_type}"`,
        status: 400,
      },
    };

  // Shallow-merge: preserve all existing top-level meta keys, add/overwrite "guitar"
  const existing =
    typeof asset.meta === "object" &&
    asset.meta !== null &&
    !Array.isArray(asset.meta)
      ? (asset.meta as Record<string, unknown>)
      : {};

  const { error: updateError } = await db
    .from("assets")
    .update({
      meta: { ...existing, guitar: args.guitar },
      last_updated: new Date().toISOString(),
    })
    .eq("id", asset.id);

  if (updateError)
    return { error: { message: updateError.message, status: 400 } };
  return { error: null };
}
