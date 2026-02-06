import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
        id,
        name,
        root_node_id,
        root_node:project_nodes!projects_root_node_id_fkey (
          id,
          name,
          asset_id,
          asset:assets!project_nodea_asset_id_fkey (
            id,
            name,
            type,
            asset_file_id,
            asset_file:asset_files!asset_asset_file_id_fkey (
              id,
              bucket,
              object_key,
              mime_type,
              bytes,
              file_variant
            )
          )
        )
      `,
    )
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Project not found" },
      { status: 404 },
    );
  }

  const rawFile = project.root_node?.asset?.asset_file;
  const file = Array.isArray(rawFile) ? rawFile[0] : rawFile;

  const url = file?.object_key
    ? await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: file.bucket ?? S3_BUCKET,
          Key: file.object_key,
          ResponseContentType: file.mime_type ?? undefined,
        }),
        { expiresIn: 60 },
      )
    : null;

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      root_node_id: project.root_node_id,
    },
    root_node: project.root_node ?? null,
    root_asset_file: file
      ? {
          id: file.id,
          bucket: file.bucket,
          object_key: file.object_key,
          mime_type: file.mime_type,
          bytes: file.bytes,
          file_variant: file.file_variant,
        }
      : null,
    url,
  });
}
