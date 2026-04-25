import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase";
import { mapLibraryAssetRow } from "@/app/api/assets/mappers";
import CommunityLibraryView from "@/components/community-library";

export default async function CommunityLibraryPage() {
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      owner_id,
      part_type,
      upload_date,
      upload_status,
      preview_file:asset_files!assets_preview_file_id_fkey (
        id, bucket, object_key, mime_type
      ),
      model_file:asset_files!assets_asset_file_id_fkey (
        id, bucket, object_key, mime_type
      )
    `,
    )
    .eq("upload_status", "approved")
    .order("upload_date", { ascending: false });

  const initialAssets = await Promise.all((data ?? []).map(mapLibraryAssetRow));

  return (
    <Suspense
      fallback={
        <div className="m-4 text-sm text-muted-foreground">
          Loading assets...
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <CommunityLibraryView initialAssets={initialAssets} />
      </div>
    </Suspense>
  );
}
