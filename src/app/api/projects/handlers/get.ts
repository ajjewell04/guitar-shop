import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { mapProjectListRow } from "@/app/api/projects/mappers";

type ProjectListRow = {
  id: string;
  owner_id: string;
  name: string;
  created_on: string;
  last_updated: string;
  preview_file:
    | {
        bucket: string | null;
        object_key: string | null;
        mime_type: string | null;
      }
    | Array<{
        bucket: string | null;
        object_key: string | null;
        mime_type: string | null;
      }>
    | null;
};

export async function handleGet() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabase
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
    .eq("owner_id", auth.user.id)
    .order("last_updated", { ascending: false });

  if (error) return jsonError(error.message ?? "Failed to load projects", 400);

  const projects = await Promise.all(
    ((data ?? []) as ProjectListRow[]).map(mapProjectListRow),
  );

  return NextResponse.json({ projects }, { status: 200 });
}
