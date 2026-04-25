import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { CreateNeckBodySchema } from "@/app/api/assets/neck/dto";
import { createNeckAsset } from "@/app/api/assets/neck/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateNeckBodySchema.safeParse(body);
  const name =
    parsed.success && parsed.data.name ? parsed.data.name : "Parametric Neck";

  const { data, error } = await createNeckAsset(supabase, auth.user.id, name);
  if (error) return jsonError(error.message, error.status);
  return NextResponse.json(data, { status: 201 });
}
