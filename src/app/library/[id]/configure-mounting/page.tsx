import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signGetFileUrl, unwrapRelation } from "@/app/api/_shared/s3";
import { GuitarMetaSchema } from "@/lib/guitar/schema";
import { MOUNTABLE_PART_TYPES } from "@/components/asset-mounting-wizard/flows";
import { ConfigureMountingClient } from "./configure-mounting-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ConfigureMountingPage({ params }: PageProps) {
  const { id: assetId } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: asset } = await supabase
    .from("assets")
    .select(
      `
      id,
      owner_id,
      part_type,
      meta,
      model_file:asset_files!assets_asset_file_id_fkey (
        id, bucket, object_key, mime_type
      )
    `,
    )
    .eq("id", assetId)
    .single();

  if (!asset || asset.owner_id !== user.id) {
    redirect(`/library/${user.id}`);
  }

  if (!asset.part_type || !MOUNTABLE_PART_TYPES.has(asset.part_type)) {
    redirect(`/library/${user.id}`);
  }

  const modelFile = unwrapRelation(asset.model_file);
  const modelUrl = await signGetFileUrl(modelFile, { expiresIn: 3600 });

  if (!modelUrl) redirect(`/library/${user.id}`);

  // Safely extract existing guitar config if present
  const rawMeta =
    typeof asset.meta === "object" &&
    asset.meta !== null &&
    !Array.isArray(asset.meta)
      ? (asset.meta as Record<string, unknown>)
      : {};
  const existingMetaParsed = GuitarMetaSchema.safeParse(rawMeta.guitar);
  const existingMeta = existingMetaParsed.success
    ? existingMetaParsed.data
    : undefined;

  return (
    <div className="h-full">
      <ConfigureMountingClient
        assetId={asset.id}
        partType={asset.part_type}
        userId={user.id}
        modelUrl={modelUrl}
        existingMeta={existingMeta}
      />
    </div>
  );
}
