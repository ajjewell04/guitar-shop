const PART_TYPES = [
  "body",
  "neck",
  "headstock",
  "bridge",
  "tuning_machine",
  "pickup",
  "pickguard",
  "knob",
  "switch",
  "strap_button",
  "output_jack",
  "miscellaneous",
] as const;

export type PartType = (typeof PART_TYPES)[number];

export const IMPORTABLE_PART_TYPES = [...PART_TYPES] as PartType[];

export type TemplateType = "stratocaster" | "telecaster" | "les-paul";

export type ProjectMode = "blank" | "import" | "template";
