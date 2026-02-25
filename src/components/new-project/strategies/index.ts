import type { ProjectMode } from "@/components/new-project/constants";
import type { ProjectCreationStrategy } from "../utils";
import { blankStrategy } from "./blank";
import { templateStrategy } from "./template";
import { importStrategy } from "./import";

export const STRATEGIES: Record<ProjectMode, ProjectCreationStrategy> = {
  blank: blankStrategy,
  template: templateStrategy,
  import: importStrategy,
};
