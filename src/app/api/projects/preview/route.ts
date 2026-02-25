import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type Body = {
  projectId?: string;
  previewObjectKey?: string;
  previewContentType?: string;
  previewBytes?: number;
};

async function signFileUrl(file?: {
  bucket?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
}) {
  if (!file?.object_key) return null;
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: file.bucket ?? S3_BUCKET,
      Key: file.object_key,
      ResponseContentType: file.mime_type ?? undefined,
    }),
    { expiresIn: 300 },
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.projectId || !body.previewObjectKey) {
    return NextResponse.json(
      { error: "Missing projectId/previewObjectKey" },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, preview_file_id")
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    if (!updatedFile) {
      return NextResponse.json(
        {
          error:
            "Existing preview file could not be updated (RLS or missing row)",
        },
        { status: 403 },
      );
    }

    const previewUrl = await signFileUrl(updatedFile);
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
    return NextResponse.json(
      { error: insertError?.message ?? "Preview file insert failed" },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: projectUpdateError.message },
      { status: 400 },
    );
  }

  if (!updatedProject) {
    return NextResponse.json(
      { error: "Project preview_file_id update was blocked (RLS)" },
      { status: 403 },
    );
  }

  const previewUrl = await signFileUrl(insertedFile);
  return NextResponse.json({ ok: true, previewUrl }, { status: 200 });
}
