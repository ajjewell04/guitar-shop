import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { SaveMountingBodySchema } from "@/app/api/assets/mounting/dto";
import { saveMounting } from "@/app/api/assets/mounting/service";

export async function PATCH(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = SaveMountingBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { error } = await saveMounting(supabase, auth.user.id, parsed.data);
  if (error) return jsonError(error.message, error.status);
  return NextResponse.json({ ok: true }, { status: 200 });
}
