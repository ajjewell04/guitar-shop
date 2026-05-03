export type StepId = "orient" | "review";

const FLOWS: Partial<Record<string, StepId[]>> = {
  body: ["orient", "review"],
  bridge: ["orient", "review"],
  pickup: ["orient", "review"],
};

export const MOUNTABLE_PART_TYPES = new Set(["body", "bridge", "pickup"]);

export function getFlow(partType: string): StepId[] {
  return FLOWS[partType] ?? ["orient", "review"];
}

export const STEP_LABELS: Record<StepId, string> = {
  orient: "Orient",
  review: "Review & Save",
};
