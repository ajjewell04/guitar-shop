import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signPutObjectUrl } from "@/app/api/_shared/s3";
import { PresignProjectPreviewBodySchema } from "@/app/api/projects/dto";
import { getOwnedProject } from "@/app/api/projects/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = PresignProjectPreviewBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { project, reason } = await getOwnedProject(
    supabase,
    parsed.data.projectId,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  let existingObjectKey: string | null = null;
  if (project.preview_file_id) {
    const { data: previewFile, error } = await supabase
      .from("asset_files")
      .select("object_key")
      .eq("id", project.preview_file_id)
      .maybeSingle<{ object_key: string | null }>();

    if (error) return jsonError(error.message, 400);
    existingObjectKey = previewFile?.object_key ?? null;
  }

  const objectKey =
    existingObjectKey ||
    `users/${auth.user.id}/projects/${project.id}/preview.png`;

  const contentType = "image/png";
  const url = await signPutObjectUrl({
    objectKey,
    contentType,
    expiresIn: 120,
  });

  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
