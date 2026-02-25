import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";

const DeleteSchema = z.object({
  id: z.string().uuid(),
});

export async function handleDelete(req: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return jsonError("Invalid request body", 400);
  }

  const body = parsed.data;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.id)
    .eq("owner_id", user.id)
    .single();

  if (projectError || !project) {
    return jsonError("Project not found", 404);
  }

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", body.id)
    .eq("owner_id", user.id);

  if (deleteError) {
    return jsonError(deleteError.message ?? "Delete failed", 400);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
