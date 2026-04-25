import type { ProjectCreationStrategy } from "../utils";

export const blankStrategy: ProjectCreationStrategy = {
  async prepare() {
    return {};
  },
};
