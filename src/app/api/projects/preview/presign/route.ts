import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl, unwrapRelation } from "@/app/api/_shared/s3";

type Body = { projectId?: string };

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.projectId) {
    return jsonError("Missing projectId", 400);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      `
      id,
      owner_id,
      preview_file_id,
      preview_file:asset_files!projects_preview_file_id_fkey (
        id,
        object_key
      )
    `,
    )
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    return jsonError("Project not found", 404);
  }

  if (project.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const previewFile = unwrapRelation(project.preview_file);

  const objectKey =
    previewFile?.object_key ||
    `users/${user.id}/projects/${project.id}/preview.png`;
  const contentType = "image/png";

  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 120,
  });

  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
