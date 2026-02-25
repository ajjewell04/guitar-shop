import type {
  PartType,
  ProjectMode,
  TemplateType,
} from "@/components/new-project/constants";

export type ProjectNodesPayload = {
  nodes?: Array<{
    transforms?: { position?: { x: number; y: number; z: number } } | null;
    asset?: { modelUrl?: string | null } | null;
  }>;
  error?: string;
};

export type NewProjectFormState = {
  projectName: string;
  mode: ProjectMode;
  templateType: TemplateType | null;
  file: File | null;
  assetName: string;
  partType: PartType | "";
};

export type StrategyResult = {
  templateId?: string;
  importAssetId?: string;
};

export type StrategyDeps = {
  renderModelPreview: (file: File) => Promise<Blob>;
};

export type ProjectCreationStrategy = {
  prepare: (
    state: NewProjectFormState,
    deps: StrategyDeps,
  ) => Promise<StrategyResult>;
};

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed",
): Promise<T> {
  const res = await fetch(input, init);
  const payload = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (!res.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : fallbackError;
    throw new Error(message);
  }

  return payload as T;
}
