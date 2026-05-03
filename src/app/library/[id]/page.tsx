import { Suspense } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { mapLibraryAssetRow } from "@/app/api/assets/mappers";
import CommunityLibraryView from "@/components/assets/community-library";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserLibraryPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (id !== user.id) redirect("/library");

  const { data } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      owner_id,
      part_type,
      meta,
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
    .eq("owner_id", id)
    .order("upload_date", { ascending: false });

  const rows = data ?? [];
  const mappedAssets = await Promise.all(rows.map(mapLibraryAssetRow));
  const initialAssets = mappedAssets.map((asset, i) => {
    const raw = rows[i];
    const meta =
      typeof raw?.meta === "object" &&
      raw.meta !== null &&
      !Array.isArray(raw.meta)
        ? (raw.meta as Record<string, unknown>)
        : null;
    return { ...asset, hasMounting: meta !== null && "guitar" in meta };
  });

  return (
    <Suspense
      fallback={
        <div className="m-4 text-sm text-muted-foreground">
          Loading assets...
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <CommunityLibraryView ownerId={id} initialAssets={initialAssets} />
      </div>
    </Suspense>
  );
}
