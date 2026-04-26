import type {
  PartType,
  ProjectMode,
  TemplateType,
} from "@/components/projects/new-project/constants";

export { requestJson } from "@/lib/fetch";

export type NewProjectFormState = {
  projectName: string;
  mode: ProjectMode;
  templateType: TemplateType | null;
  file: File | null;
  assetName: string;
  partType: PartType | "";
};

type StrategyResult = {
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
