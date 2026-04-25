import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signGetFileUrl, unwrapRelation } from "@/app/api/_shared/s3";
import { ExportAssetQuerySchema } from "@/app/api/assets/dto";

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = ExportAssetQuerySchema.safeParse(query);
  if (!parsed.success) return jsonError("Missing or invalid projectId", 400);

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      owner_id,
      root_node:project_nodes!projects_root_node_id_fkey (
        id,
        asset:assets!project_nodes_asset_id_fkey (
          id,
          asset_file:asset_files!assets_asset_file_id_fkey (
            id,bucket,object_key,mime_type
          )
        )
      )
    `,
    )
    .eq("id", parsed.data.projectId)
    .eq("owner_id", auth.user.id)
    .single();

  if (error || !project)
    return jsonError(error?.message ?? "Project not found", 404);

  const rootNode = unwrapRelation(project.root_node);
  const asset = unwrapRelation(rootNode?.asset);
  const file = unwrapRelation(asset?.asset_file);
  if (!file?.object_key) return jsonError("No model file found", 404);

  const filename = file.object_key.split("/").pop() ?? "model.glb";
  const url = await signGetFileUrl(file, {
    expiresIn: 60,
    contentDisposition: `attachment; filename="${filename}"`,
  });

  if (!url) return jsonError("Failed to create download URL", 500);
  return NextResponse.redirect(url);
}
