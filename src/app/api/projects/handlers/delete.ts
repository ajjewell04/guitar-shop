import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { DeleteProjectBodySchema } from "@/app/api/projects/dto";
import { getOwnedProject } from "@/app/api/projects/service";

export async function handleDelete(req: Request) {
  const supabase = await createClient();
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

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", project.id)
    .eq("owner_id", auth.user.id);

  if (deleteError) {
    return jsonError(deleteError.message ?? "Delete failed", 400);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
