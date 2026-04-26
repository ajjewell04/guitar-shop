import type { ProjectCreationStrategy } from "../utils";

export const blankStrategy: ProjectCreationStrategy = {
  prepare() {
    return Promise.resolve({});
  },
};
