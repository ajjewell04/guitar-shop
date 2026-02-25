import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { S3_BUCKET } from "@/lib/s3";
import { requireUser } from "../../_shared/auth";
import { jsonError } from "../../_shared/http";
import { signGetFileUrl } from "../../_shared/s3";

type Body = {
  projectId?: string;
  previewObjectKey?: string;
  previewContentType?: string;
  previewBytes?: number;
};

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.projectId || !body.previewObjectKey) {
    return jsonError("Missing projectId/previewObjectKey", 400);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, preview_file_id")
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    return jsonError("Project not found", 404);
  }
  if (project.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
  }

  const nowIso = new Date().toISOString();
  const mimeType = body.previewContentType ?? "image/png";

  if (project.preview_file_id) {
    const { data: updatedFile, error: updateError } = await supabase
      .from("asset_files")
      .update({
        bucket: S3_BUCKET,
        object_key: body.previewObjectKey,
        mime_type: mimeType,
        bytes: body.previewBytes ?? null,
        last_updated: nowIso,
      })
      .eq("id", project.preview_file_id)
      .eq("owner_id", user.id)
      .select("id, bucket, object_key, mime_type")
      .maybeSingle();

    if (updateError) {
      return jsonError(updateError.message, 400);
    }

    if (!updatedFile) {
      return jsonError(
        "Existing preview file could not be updated (RLS or missing row)",
        403,
      );
    }

    const previewUrl = await signGetFileUrl(updatedFile, { expiresIn: 300 });
    return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
  }

  const { data: insertedFile, error: insertError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: null,
      owner_id: user.id,
      file_variant: "preview",
      bucket: S3_BUCKET,
      object_key: body.previewObjectKey,
      mime_type: mimeType,
      bytes: body.previewBytes ?? null,
    })
    .select("id, bucket, object_key, mime_type")
    .single();

  if (insertError || !insertedFile) {
    return jsonError(insertError?.message ?? "Preview file insert failed", 400);
  }

  const { data: updatedProject, error: projectUpdateError } = await supabase
    .from("projects")
    .update({
      preview_file_id: insertedFile.id,
      last_updated: nowIso,
    })
    .eq("id", project.id)
    .eq("owner_id", user.id)
    .select("id, preview_file_id")
    .maybeSingle();

  if (projectUpdateError) {
    return jsonError(projectUpdateError.message, 400);
  }

  if (!updatedProject) {
    return jsonError("Project preview_file_id update was blocked (RLS)", 403);
  }

  const previewUrl = await signGetFileUrl(insertedFile, { expiresIn: 300 });
  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
