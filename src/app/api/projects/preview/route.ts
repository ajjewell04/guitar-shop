import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "../../_shared/auth";
import { jsonError } from "../../_shared/http";
import { signGetFileUrl } from "../../_shared/s3";
import { UpdateProjectPreviewBodySchema } from "@/app/api/projects/dto";
import {
  attachProjectPreview,
  getOwnedProject,
  upsertProjectPreviewFile,
} from "@/app/api/projects/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = UpdateProjectPreviewBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { projectId, previewObjectKey, previewContentType, previewBytes } =
    parsed.data;
  const { project, reason } = await getOwnedProject(
    supabase,
    projectId,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  const nowIso = new Date().toISOString();

  const { data: previewFile, error: upsertError } =
    await upsertProjectPreviewFile(supabase, {
      existingPreviewFileId: project.preview_file_id,
      userId: auth.user.id,
      objectKey: previewObjectKey,
      mimeType: previewContentType,
      bytes: previewBytes ?? null,
      nowIso,
    });

  if (upsertError) return jsonError(upsertError.message, 400);
  if (!previewFile) {
    return jsonError(
      "Preview file update was blocked (RLS or missing row)",
      403,
    );
  }

  if (!project.preview_file_id) {
    const { data: updatedProject, error: attachError } =
      await attachProjectPreview(supabase, {
        projectId: project.id,
        userId: auth.user.id,
        fileId: previewFile.id,
        nowIso,
      });

    if (attachError) return jsonError(attachError.message, 400);
    if (!updatedProject) {
      return jsonError("Project preview_file_id update was blocked (RLS)", 403);
    }
  }

  const previewUrl = await signGetFileUrl(previewFile, { expiresIn: 300 });
  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
