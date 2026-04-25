import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_shared/auth";
import { jsonError } from "@/app/api/_shared/http";
import { signGetFileUrl } from "@/app/api/_shared/s3";
import { TEMPLATE_S3_KEYS } from "@/app/api/assets/service";
import { S3_BUCKET } from "@/lib/s3";
import { supabaseServer } from "@/lib/supabase";

type TemplateKey = keyof typeof TEMPLATE_S3_KEYS;

export async function GET() {
  const supabase = await supabaseServer();
  const auth = await requireUser(supabase);
  if (auth instanceof Response) return auth;

  const entries = await Promise.all(
    (
      Object.entries(TEMPLATE_S3_KEYS) as Array<
        [TemplateKey, (typeof TEMPLATE_S3_KEYS)[TemplateKey]]
      >
    ).map(async ([key, value]) => {
      const signed = await signGetFileUrl(
        {
          bucket: S3_BUCKET,
          object_key: value.preview,
          mime_type: "image/png",
        },
        { expiresIn: 300 },
      );
      return [key, signed] as const;
    }),
  );

  const previews = Object.fromEntries(entries);
  if (Object.values(previews).every((url) => !url)) {
    return jsonError("Template previews unavailable", 500);
  }

  return NextResponse.json({ previews }, { status: 200 });
}
