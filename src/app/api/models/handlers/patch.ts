import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";

type PatchBody = {
  nodeId?: string;
  position?: { x: number; y: number; z: number };
};

export async function handlePatch(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const body = (await req.json()) as PatchBody;

  if (!body?.nodeId || !body?.position) {
    return jsonError("Missing nodeId or position", 400);
  }

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, transforms, project_id")
    .eq("id", body.nodeId)
    .single();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", node.project_id)
    .single();

  if (projectError || !project || project.owner_id !== user.id) {
    return jsonError("Forbidden", 403);
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

  if (updateError) return jsonError(updateError.message, 400);

  return NextResponse.json({ ok: true, transforms: nextTransforms });
}
