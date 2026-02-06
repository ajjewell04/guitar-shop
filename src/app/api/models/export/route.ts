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
        owner_id,
        root_node:project_nodes!projects_root_node_id_fkey (
          id,
          asset:assets!project_nodea_asset_id_fkey (
            id,
            asset_file:asset_files!asset_asset_file_id_fkey (
              id,
              bucket,
              object_key,
              mime_type
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

  if (!file?.object_key) {
    return NextResponse.json({ error: "No model file found" }, { status: 404 });
  }

  const filename = file.object_key.split("/").pop() ?? "model.glb";

  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: file.bucket ?? S3_BUCKET,
      Key: file.object_key,
      ResponseContentType: file.mime_type ?? undefined,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: 60 },
  );

  return NextResponse.redirect(url);
}
