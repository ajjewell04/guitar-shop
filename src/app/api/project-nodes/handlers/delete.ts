import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { DeleteProjectNodeBodySchema } from "@/app/api/project-nodes/dto";
import { getOwnedProject } from "@/app/api/project-nodes/service";

export async function handleDelete(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = DeleteProjectNodeBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parse.success) return jsonError("Invalid request body", 400);

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id")
    .eq("id", parse.data.nodeId)
    .single<{ id: string; project_id: string }>();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { project, reason } = await getOwnedProject(
    supabase,
    node.project_id,
    auth.user.id,
  );
  if (!project || reason === "forbidden") return jsonError("Forbidden", 403);

  const { data: childRows, error: childError } = await supabase
    .from("project_nodes")
    .select("id")
    .eq("project_id", node.project_id)
    .eq("parent_id", node.id)
    .limit(1);

  if (childError) return jsonError(childError.message, 400);
  if ((childRows ?? []).length > 0) {
    return jsonError("Cannot delete a node that has children.", 409);
  }

  const nowIso = new Date().toISOString();

  if (project.root_node_id === node.id) {
    const { error: clearRootError } = await supabase
      .from("project_nodes")
      .update({
        asset_id: null,
        last_updated: nowIso,
      })
      .eq("id", node.id);

    if (clearRootError) return jsonError(clearRootError.message, 400);

    return NextResponse.json({ ok: true, rootCleared: true }, { status: 200 });
  }

  const { error: deleteError } = await supabase
    .from("project_nodes")
    .delete()
    .eq("id", node.id)
    .eq("project_id", node.project_id);

  if (deleteError) return jsonError(deleteError.message, 400);

  return NextResponse.json(
    { ok: true, deletedNodeId: node.id },
    { status: 200 },
  );
}
