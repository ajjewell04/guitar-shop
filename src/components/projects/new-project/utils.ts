import type {
  PartType,
  ProjectMode,
  TemplateType,
} from "@/components/projects/new-project/constants";

export { requestJson } from "@/lib/fetch";

export type ProjectNodesPayload = {
  nodes?: Array<{
    id: string;
    parent_id: string | null;
    transforms?: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: number;
    } | null;
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
