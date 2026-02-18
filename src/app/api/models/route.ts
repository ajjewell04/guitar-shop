import { NextResponse } from "next/server";
import { CopyObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";
import { userS3Folder } from "@/lib/s3";

const TEMPLATE_S3_KEYS = {
  stratocaster: {
    glb: "templates/stratocaster-template/stratocaster-template.glb",
  },
  telecaster: {
    glb: "templates/telecaster-template/telecaster.glb",
  },
  "les-paul": {
    glb: "templates/lespaul-template/lespaul-template.glb",
  },
} as const;

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
    { expiresIn: 60 },
  );
}

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
  const view = searchParams.get("view");
  const ownerId = searchParams.get("ownerId");

  if (view === "library") {
    const isOwnLibrary = !!ownerId && ownerId === user.id;

    let query = supabase
      .from("assets")
      .select(
        `
          id,
          name,
          owner_id,
          part_type,
          upload_date,
          upload_status,
          preview_file:asset_files!assets_preview_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type
          ),
          model_file:asset_files!assets_asset_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type
          )
        `,
      )
      .order("upload_date", { ascending: false });

    if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    if (!isOwnLibrary) {
      query = query.eq("upload_status", "approved");
    }

    const { data: assets, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to retrieve assets" },
        { status: 400 },
      );
    }

    const rows = await Promise.all(
      (assets ?? []).map(async (asset) => {
        const rawPreview = asset.preview_file;
        const rawModel = asset.model_file;

        const previewFile = Array.isArray(rawPreview)
          ? rawPreview[0]
          : rawPreview;
        const modelFile = Array.isArray(rawModel) ? rawModel[0] : rawModel;

        const previewUrl = await signFileUrl(previewFile);
        const modelUrl = await signFileUrl(modelFile);

        return {
          id: asset.id,
          name: asset.name,
          owner_id: asset.owner_id,
          part_type: asset.part_type,
          upload_date: asset.upload_date,
          upload_status: asset.upload_status,
          previewUrl,
          modelUrl,
        };
      }),
    );

    return NextResponse.json({ assets: rows }, { status: 200 });
  }

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
          transforms,
          asset_id,
          asset:assets!project_nodes_asset_id_fkey (
            id,
            name,
            asset_file_id,
            asset_file:asset_files!assets_asset_file_id_fkey (
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

  const rawPreviewFile = project.root_node?.asset?.preview_file;
  const previewFile = Array.isArray(rawPreviewFile)
    ? rawPreviewFile[0]
    : rawPreviewFile;

  const url = await signFileUrl(file);
  const previewUrl = await signFileUrl(previewFile);

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
    root_preview_file: previewFile
      ? {
          id: previewFile.id,
          bucket: previewFile.bucket,
          object_key: previewFile.object_key,
          mime_type: previewFile.mime_type,
          bytes: previewFile.bytes,
          file_variant: previewFile.file_variant,
        }
      : null,
    url,
    previewUrl,
  });
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

  await userS3Folder(user.id);

  const body = (await req.json()) as {
    templateKey?: keyof typeof TEMPLATE_S3_KEYS;
  };

  const template = body.templateKey ? TEMPLATE_S3_KEYS[body.templateKey] : null;

  if (!template?.glb) {
    return NextResponse.json({ error: "Invalid templateKey" }, { status: 400 });
  }

  const templateFolder = `users/${user.id}/models/${crypto.randomUUID()}`;
  const glbKey = `${templateFolder}/${body.templateKey}.glb`;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: `${S3_BUCKET}/${template.glb}`,
      Key: glbKey,
      ContentType: "model/gltf-binary",
    }),
  );

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .insert({
      name: `${body.templateKey} template`,
      owner_id: user.id,
      meta: { template: body.templateKey },
    })
    .select("id")
    .single();

  if (assetError || !asset) {
    return NextResponse.json(
      { error: assetError?.message ?? "Asset insert failed" },
      { status: 400 },
    );
  }

  const { data: files, error: fileError } = await supabase
    .from("asset_files")
    .insert([
      {
        asset_id: asset.id,
        owner_id: user.id,
        bucket: S3_BUCKET,
        object_key: glbKey,
        file_variant: "original",
        mime_type: "model/gltf-binary",
      },
    ])
    .select("id, object_key");

  if (fileError || !files?.length) {
    return NextResponse.json(
      { error: fileError?.message ?? "Asset files insert failed" },
      { status: 400 },
    );
  }

  const primaryFile = files[0];

  const { data: updated, error: assetUpdateError } = await supabase
    .from("assets")
    .update({ asset_file_id: primaryFile.id })
    .eq("id", asset.id)
    .select("id, asset_file_id");

  if (assetUpdateError || !updated?.length) {
    return NextResponse.json(
      { error: assetUpdateError?.message ?? "Asset update failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ assetId: asset.id, glbKey });
}

export async function PATCH(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    nodeId?: string;
    position?: { x: number; y: number; z: number };
  };

  if (!body?.nodeId || !body?.position) {
    return NextResponse.json(
      { error: "Missing nodeId or position" },
      { status: 400 },
    );
  }

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, transforms, project_id")
    .eq("id", body.nodeId)
    .single();

  if (nodeError || !node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", node.project_id)
    .single();

  if (projectError || !project || project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextTransforms = {
    ...(node.transforms ?? {}),
    position: body.position,
  };

  const { error: updateError } = await supabase
    .from("project_nodes")
    .update({
      transforms: nextTransforms,
      last_updated: new Date().toISOString(),
    })
    .eq("id", node.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, transforms: nextTransforms });
}
