import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type Body = { projectId?: string };

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
  if (!body?.projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
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
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawPreview = project.preview_file as
    | { id: string; object_key: string | null }
    | { id: string; object_key: string | null }[]
    | null;
  const previewFile = Array.isArray(rawPreview) ? rawPreview[0] : rawPreview;

  const objectKey =
    previewFile?.object_key ||
    `users/${user.id}/projects/${project.id}/preview.png`;
  const contentType = "image/png";

  const url = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 120 },
  );

  return NextResponse.json({ url, objectKey, contentType }, { status: 200 });
}
