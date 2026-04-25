import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { PromoteProjectRootBodySchema } from "@/app/api/projects/dto";
import {
  getOwnedProject,
  promoteProjectRoot,
} from "@/app/api/projects/service";

export async function PATCH(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = PromoteProjectRootBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { projectId, newRootNodeId } = parsed.data;
  const { project, reason } = await getOwnedProject(
    supabase,
    projectId,
    auth.user.id,
  );
  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id, asset_id")
    .eq("id", newRootNodeId)
    .maybeSingle<{ id: string; project_id: string; asset_id: string | null }>();
  if (nodeError) return jsonError(nodeError.message, 400);
  if (!node) return jsonError("Node not found", 404);
  if (node.project_id !== project.id) {
    return jsonError("Root node must belong to the target project", 400);
  }
  if (!node.asset_id) {
    return jsonError("Root node must reference a body asset", 400);
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, part_type")
    .eq("id", node.asset_id)
    .maybeSingle<{ id: string; part_type: string | null }>();
  if (assetError) return jsonError(assetError.message, 400);
  if (!asset) return jsonError("Node asset not found", 404);
  if (asset.part_type !== "body") {
    return jsonError("Only a body node can be promoted to project root", 400);
  }

  const { data, error } = await promoteProjectRoot(supabase, {
    projectId,
    newRootNodeId,
  });
  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Project root update was blocked", 403);

  return NextResponse.json(
    { ok: true, projectId: data.project_id, rootNodeId: data.root_node_id },
    { status: 200 },
  );
}
