import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { NeckPresignBodySchema } from "@/app/api/assets/neck/dto";
import { getNeckPresignUrls } from "@/app/api/assets/neck/service";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const parsed = NeckPresignBodySchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Missing assetId", 400);

  const { data, error } = await getNeckPresignUrls(
    supabase,
    auth.user.id,
    parsed.data.assetId,
  );
  if (error) return jsonError(error.message, error.status);
  return NextResponse.json(data);
}
