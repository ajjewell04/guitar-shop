import { NextResponse } from "next/server";
import { createClient } from "@/lib/server";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1).max(50),
  mode: z.enum(["blank", "import", "template"]).default("blank"),
  templateId: z.string().uuid().optional(),
  importAssetId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = BodySchema.parse(await req.json());

  const { data, error } = await supabase
    .rpc("create_project_with_root", { p_name: body.name })
    .single<{ project_id: string; root_node_id: string }>();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Create failed" },
      { status: 400 },
    );
  }

  const { project_id, root_node_id } = data;

  if (body.mode === "import" && body.importAssetId) {
    await supabase.from("project_nodes").insert({
      project_id,
      parent_id: root_node_id,
      kind: "part",
      name: "Imported Model",
      asset_id: body.importAssetId,
      sort_index: 10,
    });
  }

  return NextResponse.json({ id: project_id, root_node_id }, { status: 201 });
}
