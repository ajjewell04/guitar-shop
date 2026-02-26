import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { deleteObjectsByBucket } from "@/app/api/_shared/s3";
import { DeleteProjectBodySchema } from "@/app/api/projects/dto";
import { getOwnedProject } from "@/app/api/projects/service";

export async function handleDelete(req: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = DeleteProjectBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { project, reason } = await getOwnedProject(
    supabase,
    parsed.data.id,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  let previewFile: { bucket: string | null; object_key: string | null } | null =
    null;

  if (project.preview_file_id) {
    const { data, error } = await supabase
      .from("asset_files")
      .select("bucket, object_key")
      .eq("id", project.preview_file_id)
      .eq("owner_id", auth.user.id)
      .maybeSingle<{ bucket: string | null; object_key: string | null }>();

    if (error)
      return jsonError(error.message ?? "Failed to read preview file", 400);
    previewFile = data ?? null;
  }

  const { error: deleteProjectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id)
    .eq("owner_id", auth.user.id);

  if (deleteProjectError) {
    return jsonError(deleteProjectError.message ?? "Delete failed", 400);
  }

  const warnings: string[] = [];

  if (project.preview_file_id) {
    const { error: deletePreviewRowError } = await supabase
      .from("asset_files")
      .delete()
      .eq("id", project.preview_file_id)
      .eq("owner_id", auth.user.id);

    if (deletePreviewRowError) {
      warnings.push("Project deleted, but preview row cleanup failed.");
    }

    if (previewFile?.object_key) {
      try {
        await deleteObjectsByBucket([previewFile]);
      } catch {
        warnings.push("Project deleted, but preview object cleanup failed.");
      }
    }
  }

  if (warnings.length > 0) {
    return NextResponse.json({ ok: true, warning: warnings.join(" ") });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
