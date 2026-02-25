// src/app/api/project-nodes/handlers/patch.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { PatchProjectNodeBodySchema } from "@/app/api/project-nodes/dto";
import {
  getOwnedProject,
  mergePosition,
} from "@/app/api/project-nodes/service";

export async function handlePatch(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parse = PatchProjectNodeBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parse.success) return jsonError("Invalid request body", 400);

  const { data: node, error: nodeError } = await supabase
    .from("project_nodes")
    .select("id, project_id, transforms")
    .eq("id", parse.data.nodeId)
    .single();

  if (nodeError || !node) return jsonError("Node not found", 404);

  const { project, reason } = await getOwnedProject(
    supabase,
    node.project_id,
    auth.user.id,
  );

  if (!project || reason === "forbidden") return jsonError("Forbidden", 403);

  const nextTransforms = mergePosition(node.transforms, parse.data.position);

  const { error: updateError } = await supabase
    .from("project_nodes")
    .update({
      transforms: nextTransforms,
      last_updated: new Date().toISOString(),
    })
    .eq("id", parse.data.nodeId);

  if (updateError) return jsonError(updateError.message, 400);

  return NextResponse.json(
    { ok: true, transforms: nextTransforms },
    { status: 200 },
  );
}
