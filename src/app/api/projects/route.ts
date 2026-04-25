import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { deleteObjectsByBucket } from "@/app/api/_shared/s3";
import {
  CreateProjectBodySchema,
  DeleteProjectBodySchema,
} from "@/app/api/projects/dto";
import { mapProjectListRow } from "@/app/api/projects/mappers";
import {
  getOwnedProject,
  createProjectWithRoot,
  assignRootAsset,
} from "@/app/api/projects/service";

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      owner_id,
      name,
      created_on,
      last_updated,
      preview_file:asset_files!projects_preview_file_id_fkey (
        bucket,
        object_key,
        mime_type
      )
    `,
    )
    .eq("owner_id", auth.user.id)
    .order("last_updated", { ascending: false });

  if (error) return jsonError(error.message ?? "Failed to load projects", 400);

  const projects = await Promise.all((data ?? []).map(mapProjectListRow));

  return NextResponse.json({ projects }, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
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

export async function DELETE(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = DeleteProjectBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { project, reason } = await getOwnedProject(
    supabase,
    parsed.data.id,
    auth.user.id,
  );

  if (!project) {
    return reason === "forbidden"
      ? jsonError("Forbidden", 403)
      : jsonError("Project not found", 404);
  }

  let previewFile: { bucket: string | null; object_key: string | null } | null =
    null;

  if (project.preview_file_id) {
    const { data, error } = await supabase
      .from("asset_files")
      .select("bucket, object_key")
      .eq("id", project.preview_file_id)
      .eq("owner_id", auth.user.id)
      .maybeSingle<{ bucket: string | null; object_key: string | null }>();

    if (error)
      return jsonError(error.message ?? "Failed to read preview file", 400);
    previewFile = data ?? null;
  }

  const { error: deleteProjectError } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id)
    .eq("owner_id", auth.user.id);

  if (deleteProjectError) {
    return jsonError(deleteProjectError.message ?? "Delete failed", 400);
  }

  const warnings: string[] = [];

  if (project.preview_file_id) {
    const { error: deletePreviewRowError } = await supabase
      .from("asset_files")
      .delete()
      .eq("id", project.preview_file_id)
      .eq("owner_id", auth.user.id);

    if (deletePreviewRowError) {
      warnings.push("Project deleted, but preview row cleanup failed.");
    }

    if (previewFile?.object_key) {
      try {
        await deleteObjectsByBucket([previewFile]);
      } catch {
        warnings.push("Project deleted, but preview object cleanup failed.");
      }
    }
  }

  if (warnings.length > 0) {
    return NextResponse.json({ ok: true, warning: warnings.join(" ") });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
