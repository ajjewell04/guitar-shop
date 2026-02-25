import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { GetProjectNodesQuerySchema } from "@/app/api/project-nodes/dto";
import { getOwnedProject } from "@/app/api/project-nodes/service";
import {
  mapLibraryAssetRow,
  mapNodeRow,
} from "@/app/api/project-nodes/mappers";

export async function handleGet(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = GetProjectNodesQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );

  if (!parse.success) return jsonError("Missing or invalid projectId", 400);

  const { project, reason } = await getOwnedProject(
    supabase,
    parse.data.projectId,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
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
          id, bucket, object_key, mime_type
        ),
        preview_file:asset_files!assets_preview_file_id_fkey (
          id, bucket, object_key, mime_type
        )
      )
    `,
    )
    .eq("project_id", parse.data.projectId)
    .order("sort_index", { ascending: true });

  if (nodesError) return jsonError(nodesError.message, 400);

  const { data: libraryAssets, error: assetsError } = await supabase
    .from("assets")
    .select(
      `
      id,
      name,
      part_type,
      upload_date,
      model_file:asset_files!assets_asset_file_id_fkey (
        id, bucket, object_key, mime_type
      ),
      preview_file:asset_files!assets_preview_file_id_fkey (
        id, bucket, object_key, mime_type
      )
    `,
    )
    .eq("owner_id", auth.user.id)
    .order("upload_date", { ascending: false });

  if (assetsError) return jsonError(assetsError.message, 400);

  const nodeRows = await Promise.all((nodes ?? []).map(mapNodeRow));
  const assetRows = await Promise.all(
    (libraryAssets ?? []).map(mapLibraryAssetRow),
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
