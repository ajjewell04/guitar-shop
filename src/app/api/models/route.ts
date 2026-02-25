export { handleGet as GET } from "@/app/api/models/handlers/get";
export { handlePost as POST } from "@/app/api/models/handlers/post";
export { handleDelete as DELETE } from "@/app/api/models/handlers/delete";
export { handlePatch as PATCH } from "@/app/api/models/handlers/patch";

/*import { NextResponse } from "next/server";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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

async function deleteFromS3(
  files: Array<{ bucket: string | null; object_key: string | null }>,
) {
  const deleteBucket = new Map<string, string[]>();

  for (const file of files) {
    if (!file.object_key) continue;
    const bucket = file.bucket ?? S3_BUCKET;
    const keys = deleteBucket.get(bucket) ?? [];
    keys.push(file.object_key);
    deleteBucket.set(bucket, keys);
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

function toCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    assetId?: string;
  } | null;

  if (!body?.assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: inUseRows, error: inUseError } = await supabase
    .from("project_nodes")
    .select("id")
    .eq("asset_id", asset.id)
    .limit(1);

  if (inUseError) {
    return NextResponse.json({ error: inUseError.message }, { status: 400 });
  }

  if ((inUseRows ?? []).length > 0) {
    return NextResponse.json(
      { error: "Asset is used by a project and cannot be deleted" },
      { status: 409 },
    );
  }

  const { data: currentAsset, error: currentAssetError } = await supabase
    .from("assets")
    .select("id, owner_id, asset_file_id, preview_file_id")
    .eq("id", body.assetId)
    .single();

  if (currentAssetError || !currentAsset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (currentAsset.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: files, error: filesReadError } = await supabase
    .from("asset_files")
    .select("id, owner_id, bucket, object_key")
    .eq("asset_id", currentAsset.id);

  if (filesReadError) {
    return NextResponse.json(
      { error: filesReadError.message },
      { status: 400 },
    );
  }

  const { error: nullRefsError } = await supabase
    .from("assets")
    .update({
      asset_file_id: null,
      preview_file_id: null,
      last_updated: new Date().toISOString(),
    })
    .eq("id", currentAsset.id)
    .eq("owner_id", user.id);

  if (nullRefsError) {
    return NextResponse.json({ error: nullRefsError.message }, { status: 400 });
  }

  const { data: deletedFiles, error: deleteFilesError } = await supabase
    .from("asset_files")
    .delete()
    .eq("asset_id", currentAsset.id)
    .eq("owner_id", user.id)
    .select("id");

  if (deleteFilesError) {
    await supabase
      .from("assets")
      .update({
        asset_file_id: currentAsset.asset_file_id,
        preview_file_id: currentAsset.preview_file_id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", currentAsset.id)
      .eq("owner_id", user.id);
    return NextResponse.json(
      { error: deleteFilesError.message },
      { status: 400 },
    );
  }

  const expectedFileCount = files?.length ?? 0;
  const actualDeletedFileCount = deletedFiles?.length ?? 0;

  if (actualDeletedFileCount !== expectedFileCount) {
    await supabase
      .from("assets")
      .update({
        asset_file_id: currentAsset.asset_file_id,
        preview_file_id: currentAsset.preview_file_id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", currentAsset.id)
      .eq("owner_id", user.id);

    return NextResponse.json(
      { error: "Delete blocked by policy: could not delete asset files" },
      { status: 403 },
    );
  }

  const { data: deletedAsset, error: deleteAssetError } = await supabase
    .from("assets")
    .delete()
    .eq("id", currentAsset.id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteAssetError || !deletedAsset) {
    return NextResponse.json(
      {
        error:
          deleteAssetError?.message ??
          "Delete blocked by policy: asset not deleted",
      },
      { status: 403 },
    );
  }

  if ((files ?? []).length > 0) {
    try {
      await deleteFromS3(files);
    } catch {
      return NextResponse.json(
        { ok: true, warning: "Asset deleted, but S3 deletion failed" },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
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
    if (ownerId && ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
    } else {
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
    mode?: "template" | "copy_to_library";
    templateKey?: keyof typeof TEMPLATE_S3_KEYS;
    sourceAssetId?: string;
  };

  if (body.mode === "copy_to_library") {
    if (!body.sourceAssetId) {
      return NextResponse.json(
        { error: "Missing sourceAssetId" },
        { status: 400 },
      );
    }

    const { data: source, error: sourceError } = await supabase
      .from("assets")
      .select(
        `
          id,
          name,
          owner_id,
          part_type,
          upload_status,
          meta,
          model_file:asset_files!assets_asset_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type,
            bytes
          ),
          preview_file:asset_files!assets_preview_file_id_fkey (
            id,
            bucket,
            object_key,
            mime_type,
            bytes
          )
        `,
      )
      .eq("id", body.sourceAssetId)
      .eq("upload_status", "approved")
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: "Approved source asset not found" },
        { status: 404 },
      );
    }

    const rawModel = source.model_file;
    const rawPreview = source.preview_file;
    const modelFile = Array.isArray(rawModel) ? rawModel[0] : rawModel;
    const previewFile = Array.isArray(rawPreview) ? rawPreview[0] : rawPreview;

    if (!modelFile?.object_key || !previewFile?.object_key) {
      return NextResponse.json(
        { error: "Source asset is missing model/preview files" },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();

    const { data: newAsset, error: newAssetError } = await supabase
      .from("assets")
      .insert({
        name: source.name,
        part_type: source.part_type,
        owner_id: user.id,
        upload_status: null,
        upload_date: nowIso,
        last_updated: nowIso,
        meta: source.meta ?? null,
      })
      .select("id")
      .single();

    if (newAssetError || !newAsset) {
      return NextResponse.json(
        { error: newAssetError?.message ?? "Asset insert failed" },
        { status: 400 },
      );
    }

    const modelFilename = modelFile.object_key.split("/").pop() ?? "model.glb";
    const previewFilename =
      previewFile.object_key.split("/").pop() ?? "preview.png";
    const copiedModelKey = `users/${user.id}/models/${newAsset.id}/${modelFilename}`;
    const copiedPreviewKey = `users/${user.id}/models/${newAsset.id}/${previewFilename}`;

    await Promise.all([
      s3Client.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: toCopySource(
            modelFile.bucket ?? S3_BUCKET,
            modelFile.object_key,
          ),
          Key: copiedModelKey,
        }),
      ),
      s3Client.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          CopySource: toCopySource(
            previewFile.bucket ?? S3_BUCKET,
            previewFile.object_key,
          ),
          Key: copiedPreviewKey,
        }),
      ),
    ]);

    const { data: copiedFiles, error: copiedFilesError } = await supabase
      .from("asset_files")
      .insert([
        {
          asset_id: newAsset.id,
          owner_id: user.id,
          bucket: S3_BUCKET,
          object_key: copiedModelKey,
          file_variant: "original",
          mime_type: modelFile.mime_type ?? "model/gltf-binary",
          bytes: modelFile.bytes ?? null,
        },
        {
          asset_id: newAsset.id,
          owner_id: user.id,
          bucket: S3_BUCKET,
          object_key: copiedPreviewKey,
          file_variant: "preview",
          mime_type: previewFile.mime_type ?? "image/png",
          bytes: previewFile.bytes ?? null,
        },
      ])
      .select("id, file_variant");

    if (copiedFilesError || !copiedFiles?.length) {
      return NextResponse.json(
        {
          error:
            copiedFilesError?.message ?? "Copied asset_files insert failed",
        },
        { status: 400 },
      );
    }

    const copiedOriginal = copiedFiles.find(
      (f) => f.file_variant === "original",
    );
    const copiedPreview = copiedFiles.find((f) => f.file_variant === "preview");

    if (!copiedPreview || !copiedOriginal) {
      return NextResponse.json(
        { error: "Both copied original and preview files are required" },
        { status: 400 },
      );
    }

    const { error: updateAssetError } = await supabase
      .from("assets")
      .update({
        asset_file_id: copiedOriginal.id,
        preview_file_id: copiedPreview.id,
        last_updated: nowIso,
      })
      .eq("id", newAsset.id);

    if (updateAssetError) {
      return NextResponse.json(
        { error: updateAssetError.message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { assetId: newAsset.id, copiedFromAssetId: source.id },
      { status: 201 },
    );
  }

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
}*/
