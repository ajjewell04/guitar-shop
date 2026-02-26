import type { ProjectMode } from "./constants";
import type { NewProjectFormState, StrategyDeps } from "./utils";
import { STRATEGIES } from "./strategies";
import { requestJson } from "./utils";

type CreateProjectResponse = { id?: string };

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
