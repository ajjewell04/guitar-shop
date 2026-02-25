import type { ProjectCreationStrategy } from "../utils";
import { requestJson } from "../utils";

type TemplateCreateResponse = { assetId?: string };

export const templateStrategy: ProjectCreationStrategy = {
  async prepare(state) {
    if (!state.templateType) {
      throw new Error("Select a template.");
    }

    const data = await requestJson<TemplateCreateResponse>(
      "/api/models",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: state.templateType }),
      },
      "Template asset create failed",
    );

    if (!data.assetId) {
      throw new Error("Template created but no assetId returned.");
    }

    return { templateId: data.assetId };
  },
};
