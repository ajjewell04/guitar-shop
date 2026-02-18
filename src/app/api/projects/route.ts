import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { z } from "zod";
import { DeleteObjectsCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

const BodySchema = z.object({
  name: z.string().min(1).max(50),
  mode: z.enum(["blank", "import", "template"]).default("blank"),
  templateId: z.string().uuid().optional(),
  importAssetId: z.string().uuid().optional(),
});

async function deleteFromS3(
  files: Array<{ bucket: string | null; object_key: string | null }>,
) {
  const deleteBucket = new Map<string, string[]>();
  for (const file of files) {
    if (!file.object_key) continue;
    const bucket = file.bucket ?? S3_BUCKET;
    const list = deleteBucket.get(bucket) ?? [];
    list.push(file.object_key);
    deleteBucket.set(bucket, list);
  }

  for (const [bucket, keys] of deleteBucket) {
    for (let ii = 0; ii < keys.length; ii += 1000) {
      const chunk = keys.slice(ii, ii + 1000).map((Key) => ({ Key }));
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: chunk, Quiet: true },
        }),
      );
    }
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = DeleteSchema.parse(await req.json());

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.id)
    .eq("owner_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  /*const { data: nodes, error: nodeError } = await supabase
    .from("project_nodes")
    .select("asset_id")
    .eq("project_id", body.id);

  if (nodeError) {
    return NextResponse.json({ error: nodeError?.message }, { status: 400 });
  }

  const assetIds = [
    ...new Set(
      (nodes ?? [])
        .map((node) => node.asset_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  let files: Array<{ bucket: string | null; object_key: string | null }> = [];
  if (assetIds.length > 0) {
    const { data: assetFiles, error: assetFileError } = await supabase
      .from("asset_files")
      .select("bucket, object_key")
      .in("asset_id", assetIds);

    if (assetFileError) {
      return NextResponse.json(
        { error: assetFileError?.message },
        { status: 400 },
      );
    }
    files = assetFiles ?? [];
  }*/

  const { error: deleteFilesError } = await supabase
    .from("projects")
    .delete()
    .eq("id", body.id)
    .eq("owner_id", user.id);

  if (deleteFilesError) {
    return NextResponse.json(
      { error: deleteFilesError?.message },
      { status: 400 },
    );
  }

  /*if (files.length > 0) {
    try {
      await deleteFromS3(files);
    } catch {
      return NextResponse.json(
        { ok: true, error: "Project deleted, but S3 deletion failed" },
        { status: 200 },
      );
    }
  }*/

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = BodySchema.parse(await req.json());

  const { data, error } = await supabase
    .rpc("create_project_with_root", { p_name: body.name })
    .single<{ project_id: string; root_node_id: string }>();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  const { project_id, root_node_id } = data;

  if (body.mode === "template" && body.templateId) {
    await supabase
      .from("project_nodes")
      .update({ asset_id: body.templateId })
      .eq("id", root_node_id);
  }

  if (body.mode === "import" && body.importAssetId) {
    await supabase
      .from("project_nodes")
      .update({ asset_id: body.importAssetId })
      .eq("id", root_node_id);
  }

  return NextResponse.json({ id: project_id, root_node_id }, { status: 201 });
}

async function signFileUrl(file?: {
  bucket: string | null;
  object_key: string | null;
  mime_type: string | null;
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

export async function GET(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
        id,
        owner_id,
        name,
        created_on,
        last_updated,
        root_node_id,
        root_node:project_nodes!projects_root_node_id_fkey (
          asset:assets!project_nodes_asset_id_fkey (
          id,
          preview_file:asset_files!assets_preview_file_id_fkey (
            bucket,
            object_key,
            mime_type
          )
        )
      )`,
    )
    .eq("owner_id", user.id)
    .order("last_updated", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error?.message }, { status: 400 });
  }

  const projects = await Promise.all(
    (data ?? []).map(async (project) => {
      const rawPreview = project.root_node?.asset?.preview_file;
      const previewFile = Array.isArray(rawPreview)
        ? rawPreview[0]
        : rawPreview;
      const previewUrl = await signFileUrl(previewFile);
      return {
        id: project.id,
        owner_id: project.owner_id,
        name: project.name,
        created_on: project.created_on,
        last_updated: project.last_updated,
        previewUrl,
      };
    }),
  );

  return NextResponse.json({ projects }, { status: 200 });
}
