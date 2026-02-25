import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { PatchModelBodySchema } from "@/app/api/models/dto";
import { getOwnedProject, mergePosition } from "@/app/api/models/service";

export async function handlePatch(req: Request) {
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
