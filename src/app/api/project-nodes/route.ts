export { handleGet as GET } from "@/app/api/project-nodes/handlers/get";
export { handlePost as POST } from "@/app/api/project-nodes/handlers/post";
export { handlePatch as PATCH } from "@/app/api/project-nodes/handlers/patch";
/*import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type Position = { x: number; y: number; z: number };

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

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: nodes, error: nodesError } = await supabase
    .from("project_nodes")
    .select(
      `
      id,
      project_id,
      type,
      parent_id,
      sort_index,
      name,
      asset_id,
      transforms,
      last_updated,
      asset:assets!project_nodes_asset_id_fkey (
        id,
        name,
        part_type,
        model_file:asset_files!assets_asset_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id,
          bucket,
          object_key,
          mime_type
        )
      )
    `,
    )
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true });

  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 400 });
  }

  const { data: libraryAssets, error: assetsError } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      part_type,
      upload_date,
      model_file:asset_files!assets_asset_file_id_fkey (
        id,
        bucket,
        object_key,
        mime_type
      ),
      preview_file:asset_files!assets_preview_file_id_fkey (
        id,
        bucket,
        object_key,
        mime_type
      )
    `,
    )
    .eq("owner_id", user.id)
    .order("upload_date", { ascending: false });

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 400 });
  }

  const nodeRows = await Promise.all(
    (nodes ?? []).map(async (node) => {
      const rawModel = node.asset?.model_file;
      const rawPreview = node.asset?.preview_file;
      const modelFile = Array.isArray(rawModel) ? rawModel[0] : rawModel;
      const previewFile = Array.isArray(rawPreview)
        ? rawPreview[0]
        : rawPreview;

      return {
        id: node.id,
        project_id: node.project_id,
        type: node.type,
        parent_id: node.parent_id,
        sort_index: node.sort_index,
        name: node.name,
        asset_id: node.asset_id,
        transforms: node.transforms ?? {},
        last_updated: node.last_updated,
        asset: node.asset
          ? {
              id: node.asset.id,
              name: node.asset.name,
              part_type: node.asset.part_type,
              modelUrl: await signFileUrl(modelFile),
              previewUrl: await signFileUrl(previewFile),
            }
          : null,
      };
    }),
  );

  const assetRows = await Promise.all(
    (libraryAssets ?? []).map(async (asset) => {
      const rawModel = asset.model_file;
      const rawPreview = asset.preview_file;
      const modelFile = Array.isArray(rawModel) ? rawModel[0] : rawModel;
      const previewFile = Array.isArray(rawPreview)
        ? rawPreview[0]
        : rawPreview;

      return {
        id: asset.id,
        name: asset.name,
        part_type: asset.part_type,
        upload_date: asset.upload_date,
        modelUrl: await signFileUrl(modelFile),
        previewUrl: await signFileUrl(previewFile),
      };
    }),
  );

  return NextResponse.json(
    {
      project: {
        id: project.id,
        root_node_id: project.root_node_id,
      },
      nodes: nodeRows,
      libraryAssets: assetRows,
    },
    { status: 200 },
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

  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    assetId?: string;
    parentId?: string | null;
  } | null;

  if (!body?.projectId || !body?.assetId) {
    return NextResponse.json(
      { error: "Missing projectId or assetId" },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id, root_node_id")
    .eq("id", body.projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, owner_id, name")
    .eq("id", body.assetId)
    .single();

  if (assetError || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: maxSortRow, error: maxSortError } = await supabase
    .from("project_nodes")
    .select("sort_index")
    .eq("project_id", body.projectId)
    .order("sort_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxSortError) {
    return NextResponse.json({ error: maxSortError.message }, { status: 400 });
  }

  const nextSortIndex = (maxSortRow?.sort_index ?? -1) + 1;
  const isRootInsert = !project.root_node_id;

  const { data: insertedNode, error: insertError } = await supabase
    .from("project_nodes")
    .insert({
      project_id: body.projectId,
      type: isRootInsert ? "assembly" : "part",
      parent_id: body.parentId ?? null, // can be changed later when parenting UX is added
      sort_index: nextSortIndex,
      name: asset.name,
      asset_id: asset.id,
      transforms: { position: { x: 0, y: 0, z: 0 } as Position },
      meta: {},
      overrides: {},
      last_updated: new Date().toISOString(),
    })
    .select(
      "id, project_id, type, parent_id, sort_index, name, asset_id, transforms",
    )
    .single();

  if (insertError || !insertedNode) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create node" },
      { status: 400 },
    );
  }

  if (isRootInsert) {
    const { error: updateRootError } = await supabase
      .from("projects")
      .update({
        root_node_id: insertedNode.id,
        last_updated: new Date().toISOString(),
      })
      .eq("id", body.projectId);

    if (updateRootError) {
      return NextResponse.json(
        { error: updateRootError.message },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ node: insertedNode }, { status: 201 });
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

  const body = (await req.json().catch(() => null)) as {
    nodeId?: string;
    position?: Position;
  } | null;

  if (!body?.nodeId || !body.position) {
    return NextResponse.json(
      { error: "Missing nodeId or position" },
      { status: 400 },
    );
  }

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id, transforms")
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
    .eq("id", body.nodeId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, transforms: nextTransforms },
    { status: 200 },
  );
}*/
