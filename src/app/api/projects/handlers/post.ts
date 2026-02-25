import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { CreateProjectBodySchema } from "@/app/api/projects/dto";
import {
  assignRootAsset,
  createProjectWithRoot,
} from "@/app/api/projects/service";

export async function handlePost(req: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = CreateProjectBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const body = parsed.data;
  const { data, error } = await createProjectWithRoot(supabase, body.name);

  if (error || !data) {
    return jsonError(error?.message ?? "Create failed", 400);
  }

  if (body.mode === "template" && body.templateId) {
    const { error: templateUpdateError } = await assignRootAsset(
      supabase,
      data.root_node_id,
      body.templateId,
    );
    if (templateUpdateError) {
      return jsonError(
        templateUpdateError.message ?? "Template asset assignment failed",
        400,
      );
    }
  }

  if (body.mode === "import" && body.importAssetId) {
    const { error: importUpdateError } = await assignRootAsset(
      supabase,
      data.root_node_id,
      body.importAssetId,
    );
    if (importUpdateError) {
      return jsonError(
        importUpdateError.message ?? "Import asset assignment failed",
        400,
      );
    }
  }

  return NextResponse.json(
    { id: data.project_id, root_node_id: data.root_node_id },
    { status: 201 },
  );
}
