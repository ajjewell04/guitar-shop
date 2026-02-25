import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";

const BodySchema = z.object({
  name: z.string().min(1).max(50),
  mode: z.enum(["blank", "import", "template"]).default("blank"),
  templateId: z.string().uuid().optional(),
  importAssetId: z.string().uuid().optional(),
});

export async function handlePost(req: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const body = parsed.data;

  const { data, error } = await supabase
    .rpc("create_project_with_root", { p_name: body.name })
    .single<{ project_id: string; root_node_id: string }>();

  if (error || !data) {
    return jsonError(error?.message ?? "Create failed", 400);
  }

  const { project_id, root_node_id } = data;

  if (body.mode === "template" && body.templateId) {
    const { error: templateUpdateError } = await supabase
      .from("project_nodes")
      .update({ asset_id: body.templateId })
      .eq("id", root_node_id);

    if (templateUpdateError) {
      return jsonError(
        templateUpdateError.message ?? "Template asset assignment failed",
        400,
      );
    }
  }

  if (body.mode === "import" && body.importAssetId) {
    const { error: importUpdateError } = await supabase
      .from("project_nodes")
      .update({ asset_id: body.importAssetId })
      .eq("id", root_node_id);

    if (importUpdateError) {
      return jsonError(
        importUpdateError.message ?? "Import asset assignment failed",
        400,
      );
    }
  }

  return NextResponse.json({ id: project_id, root_node_id }, { status: 201 });
}
