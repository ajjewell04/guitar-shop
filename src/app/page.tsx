import { Suspense } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import { mapProjectListRow } from "@/app/api/projects/mappers";
import { ProjectList } from "@/components/projects/project-list";

export default async function Home() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialProjects: Awaited<ReturnType<typeof mapProjectListRow>>[] = [];

  if (user) {
    const { data } = await supabase
      .from("projects")
      .select(
        `
        id,
        owner_id,
        name,
        created_on,
        last_updated,
        preview_file:asset_files!projects_preview_file_id_fkey (
          bucket,
          object_key,
          mime_type
        )
      `,
      )
      .eq("owner_id", user.id)
      .order("last_updated", { ascending: false });

    initialProjects = await Promise.all((data ?? []).map(mapProjectListRow));
  }

  return (
    <Suspense
      fallback={
        <div className="m-4 text-sm text-muted-foreground">
          Loading projects...
        </div>
      }
    >
      <ProjectList initialProjects={initialProjects} />
    </Suspense>
  );
}
