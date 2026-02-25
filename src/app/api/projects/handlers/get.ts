import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signGetFileUrl, unwrapRelation } from "@/app/api/_shared/s3";

export async function handleGet() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;

  const { data: projectsData, error } = await supabase
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

  if (error) {
    return jsonError(error.message ?? "Failed to load projects", 400);
  }

  const projects = await Promise.all(
    (projectsData ?? []).map(async (project) => {
      const preview = unwrapRelation(project.preview_file);
      const previewUrl = await signGetFileUrl(preview, { expiresIn: 300 });

      return {
        id: project.id,
        owner_id: project.owner_id,
        name: project.name,
        created_on: project.created_on,
        last_updated: project.last_updated,
        previewUrl,
      };
    }),
  );

  return NextResponse.json({ projects }, { status: 200 });
}
