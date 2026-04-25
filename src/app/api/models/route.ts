import { NextResponse } from "next/server";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET, userS3Folder } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import {
  signGetFileUrl,
  unwrapRelation,
  deleteObjectsByBucket,
  type S3FileRef,
} from "@/app/api/_shared/s3";
import {
  GetModelsQuerySchema,
  CreateModelBodySchema,
  DeleteModelBodySchema,
  PatchModelBodySchema,
} from "@/app/api/models/dto";
import { mapLibraryAssetRow } from "@/app/api/models/mappers";
import {
  getOwnedAsset,
  getOwnedProject,
  mergePosition,
  TEMPLATE_S3_KEYS,
  toCopySource,
} from "@/app/api/models/service";

type ProjectModelRow = {
  id: string;
  name: string;
  nodes: Array<{
    id: string;
    name: string;
    transforms: Record<string, unknown> | null;
    asset_id: string | null;
    asset: {
      id: string;
      name: string;
      asset_file_id: string | null;
      preview_file_id: string | null;
      asset_file?: S3FileRef | S3FileRef[] | null;
      preview_file?: S3FileRef | S3FileRef[] | null;
    } | null;
  }> | null;
};

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = GetModelsQuerySchema.safeParse(query);
  if (!parsed.success) return jsonError("Invalid query params", 400);

  const { projectId, view, ownerId } = parsed.data;

  if (view === "library") {
    if (ownerId && ownerId !== auth.user.id) return jsonError("Forbidden", 403);

    let q = supabase
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
          id,bucket,object_key,mime_type
        ),
        model_file:asset_files!assets_asset_file_id_fkey (
          id,bucket,object_key,mime_type
        )
      `,
      )
      .order("upload_date", { ascending: false });

    q = ownerId ? q.eq("owner_id", ownerId) : q.eq("upload_status", "approved");

    const { data, error } = await q;
    if (error)
      return jsonError(error.message ?? "Failed to retrieve assets", 400);

    const assets = await Promise.all((data ?? []).map(mapLibraryAssetRow));
    return NextResponse.json({ assets }, { status: 200 });
  }

  if (!projectId) return jsonError("Missing projectId", 400);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      nodes:project_nodes (
        id,name,transforms,asset_id,
        asset:assets!project_nodes_asset_id_fkey (
          id,name,asset_file_id,preview_file_id,
          asset_file:asset_files!assets_asset_file_id_fkey (
            id,bucket,object_key,mime_type,bytes,file_variant
          ),
          preview_file:asset_files!assets_preview_file_id_fkey (
            id,bucket,object_key,mime_type,bytes,file_variant
          )
        )
      )
    `,
    )
    .eq("id", projectId)
    .eq("owner_id", auth.user.id)
    .single<ProjectModelRow>();

  if (error || !project)
    return jsonError(error?.message ?? "Project not found", 404);

  const rootNode =
    (project.nodes ?? []).find((node) => !!node.asset_id) ?? null;
  const file = unwrapRelation(rootNode?.asset?.asset_file);
  const previewFile = unwrapRelation(rootNode?.asset?.preview_file);

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
      },
      root_node: rootNode,
      root_asset_file: file ?? null,
      root_preview_file: previewFile ?? null,
      url: await signGetFileUrl(file, { expiresIn: 60 }),
      previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  await userS3Folder(auth.user.id);

  const parsed = CreateModelBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const body = parsed.data;

  if (body.mode === "copy_to_library") {
    if (!body.sourceAssetId) return jsonError("Missing sourceAssetId", 400);

    const { data: source, error: sourceError } = await supabase
      .from("assets")
      .select(
        `
        id,name,owner_id,part_type,upload_status,meta,
        model_file:asset_files!assets_asset_file_id_fkey (
          id,bucket,object_key,mime_type,bytes
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,bucket,object_key,mime_type,bytes
        )
      `,
      )
      .eq("id", body.sourceAssetId)
      .eq("upload_status", "approved")
      .single();

    if (sourceError || !source)
      return jsonError("Approved source asset not found", 404);

    const modelFile = unwrapRelation(source.model_file);
    const previewFile = unwrapRelation(source.preview_file);

    if (!modelFile?.object_key || !previewFile?.object_key) {
      return jsonError("Source asset is missing model/preview files", 400);
    }

    const nowIso = new Date().toISOString();
    const { data: newAsset, error: newAssetError } = await supabase
      .from("assets")
      .insert({
        name: source.name,
        part_type: source.part_type,
        owner_id: auth.user.id,
        upload_status: null,
        upload_date: nowIso,
        last_updated: nowIso,
        meta: source.meta ?? null,
      })
      .select("id")
      .single();

    if (newAssetError || !newAsset) {
      return jsonError(newAssetError?.message ?? "Asset insert failed", 400);
    }

    const modelFilename = modelFile.object_key.split("/").pop() ?? "model.glb";
    const previewFilename =
      previewFile.object_key.split("/").pop() ?? "preview.png";
    const copiedModelKey = `users/${auth.user.id}/models/${newAsset.id}/${modelFilename}`;
    const copiedPreviewKey = `users/${auth.user.id}/models/${newAsset.id}/${previewFilename}`;

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

    return NextResponse.json(
      { assetId: newAsset.id, copiedFromAssetId: source.id },
      { status: 201 },
    );
  }

  const template = body.templateKey ? TEMPLATE_S3_KEYS[body.templateKey] : null;
  if (!template?.glb || !template.preview)
    return jsonError("Invalid templateKey", 400);

  const nowIso = new Date().toISOString();
  const { data: newAsset, error: newAssetError } = await supabase
    .from("assets")
    .insert({
      name: `${body.templateKey} template`,
      owner_id: auth.user.id,
      upload_status: null,
      upload_date: nowIso,
      last_updated: nowIso,
      meta: { source: "template", templateKey: body.templateKey },
    })
    .select("id")
    .single();

  if (newAssetError || !newAsset) {
    return jsonError(
      newAssetError?.message ?? "Template asset insert failed",
      400,
    );
  }

  const folder = `users/${auth.user.id}/models/${crypto.randomUUID()}`;
  const modelFilename =
    template.glb.split("/").pop() ?? `${body.templateKey}.glb`;
  const previewFilename = template.preview.split("/").pop() ?? "preview.png";
  const copiedModelKey = `${folder}/${modelFilename}`;
  const copiedPreviewKey = `${folder}/${previewFilename}`;

  await Promise.all([
    s3Client.send(
      new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: toCopySource(S3_BUCKET, template.glb),
        Key: copiedModelKey,
        ContentType: "model/gltf-binary",
      }),
    ),
    s3Client.send(
      new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: toCopySource(S3_BUCKET, template.preview),
        Key: copiedPreviewKey,
        ContentType: "image/png",
      }),
    ),
  ]);

  const { data: modelFile, error: modelFileError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: newAsset.id,
      owner_id: auth.user.id,
      file_variant: "original",
      bucket: S3_BUCKET,
      object_key: copiedModelKey,
      mime_type: "model/gltf-binary",
    })
    .select("id")
    .single();

  if (modelFileError || !modelFile) {
    return jsonError(
      modelFileError?.message ?? "Model file record insert failed",
      400,
    );
  }

  const { data: previewFile, error: previewFileError } = await supabase
    .from("asset_files")
    .insert({
      asset_id: newAsset.id,
      owner_id: auth.user.id,
      file_variant: "preview",
      bucket: S3_BUCKET,
      object_key: copiedPreviewKey,
      mime_type: "image/png",
    })
    .select("id")
    .single();

  if (previewFileError || !previewFile) {
    return jsonError(
      previewFileError?.message ?? "Preview file record insert failed",
      400,
    );
  }

  const { error: updateAssetError } = await supabase
    .from("assets")
    .update({
      asset_file_id: modelFile.id,
      preview_file_id: previewFile.id,
      last_updated: nowIso,
    })
    .eq("id", newAsset.id)
    .eq("owner_id", auth.user.id);

  if (updateAssetError) {
    return jsonError(
      updateAssetError.message ?? "Asset file linkage failed",
      400,
    );
  }

  return NextResponse.json({ assetId: newAsset.id }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = DeleteModelBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { asset, reason } = await getOwnedAsset(
    supabase,
    parsed.data.assetId,
    auth.user.id,
  );
  if (!asset) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Asset not found", 404);
  }

  const { data: inUseRows, error: inUseError } = await supabase
    .from("project_nodes")
    .select("id")
    .eq("asset_id", asset.id)
    .limit(1);

  if (inUseError) return jsonError(inUseError.message, 400);
  if ((inUseRows ?? []).length > 0) {
    return jsonError("Asset is used by a project and cannot be deleted", 409);
  }

  const { data: files, error: filesReadError } = await supabase
    .from("asset_files")
    .select("id, owner_id, bucket, object_key")
    .eq("asset_id", asset.id);

  if (filesReadError) return jsonError(filesReadError.message, 400);

  const nowIso = new Date().toISOString();

  const { error: nullRefsError } = await supabase
    .from("assets")
    .update({
      asset_file_id: null,
      preview_file_id: null,
      last_updated: nowIso,
    })
    .eq("id", asset.id)
    .eq("owner_id", auth.user.id);

  if (nullRefsError) return jsonError(nullRefsError.message, 400);

  const { data: deletedFiles, error: deleteFilesError } = await supabase
    .from("asset_files")
    .delete()
    .eq("asset_id", asset.id)
    .eq("owner_id", auth.user.id)
    .select("id");

  if (deleteFilesError) return jsonError(deleteFilesError.message, 400);

  if ((deletedFiles?.length ?? 0) !== (files?.length ?? 0)) {
    return jsonError(
      "Delete blocked by policy: could not delete asset files",
      403,
    );
  }

  const { data: deletedAsset, error: deleteAssetError } = await supabase
    .from("assets")
    .delete()
    .eq("id", asset.id)
    .eq("owner_id", auth.user.id)
    .select("id")
    .maybeSingle();

  if (deleteAssetError || !deletedAsset) {
    return jsonError(
      deleteAssetError?.message ??
        "Delete blocked by policy: asset not deleted",
      403,
    );
  }

  if ((files ?? []).length > 0) {
    try {
      await deleteObjectsByBucket(files);
    } catch {
      return NextResponse.json(
        { ok: true, warning: "Asset deleted, but S3 deletion failed" },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PATCH(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = PatchModelBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { nodeId, position } = parsed.data;

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, transforms, project_id")
    .eq("id", nodeId)
    .single();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { project } = await getOwnedProject(
    supabase,
    node.project_id,
    auth.user.id,
  );
  if (!project) return jsonError("Forbidden", 403);

  const nextTransforms = mergePosition(node.transforms, position);

  const { error: updateError } = await supabase
    .from("project_nodes")
    .update({
      transforms: nextTransforms,
      last_updated: new Date().toISOString(),
    })
    .eq("id", node.id);

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json(
    { ok: true, transforms: nextTransforms },
    { status: 200 },
  );
}
