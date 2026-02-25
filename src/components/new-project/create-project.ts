import type { ProjectMode } from "./constants";
import type {
  NewProjectFormState,
  StrategyDeps,
  ProjectNodesPayload,
} from "./utils";
import { requestJson } from "./utils";
import { STRATEGIES } from "./strategies";
import {
  saveProjectPreview,
  toPreviewNodes,
} from "@/lib/project-preview-client";

type CreateProjectResponse = { id?: string };

async function generateProjectPreviewFromNodes(projectId: string) {
  const res = await fetch(`/api/project-nodes?projectId=${projectId}`, {
    cache: "no-store",
  });

  const payload = (await res.json().catch(() => ({}))) as ProjectNodesPayload;
  if (!res.ok) {
    throw new Error(payload?.error ?? "Failed to load nodes for preview");
  }

  const previewNodes = toPreviewNodes(payload.nodes ?? []);
  if (!previewNodes.length) return;

  await saveProjectPreview(projectId, previewNodes);
}

export async function createProjectWithStrategy(
  state: NewProjectFormState,
  deps: StrategyDeps,
): Promise<string> {
  const strategy = STRATEGIES[state.mode];
  const prepared = await strategy.prepare(state, deps);

  const payload: {
    name: string;
    mode: ProjectMode;
    templateId?: string;
    importAssetId?: string;
  } = {
    name: state.projectName.trim(),
    mode: state.mode,
    ...prepared,
  };

  const created = await requestJson<CreateProjectResponse>(
    "/api/projects",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Create failed",
  );

  if (!created.id) throw new Error("Project created, but no ID returned");
  return created.id;
}
