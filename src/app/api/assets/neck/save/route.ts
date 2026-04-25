import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { SaveNeckBodySchema } from "@/app/api/assets/neck/dto";
import { saveNeckParams } from "@/app/api/assets/neck/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = SaveNeckBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request body", 400);

  const { error } = await saveNeckParams(supabase, auth.user.id, parsed.data);
  if (error) return jsonError(error.message, error.status);
  return NextResponse.json({ ok: true }, { status: 200 });
}
