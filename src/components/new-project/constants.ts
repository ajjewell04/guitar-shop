export const PART_TYPES = [
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

export const TEMPLATE_TYPES = [
  "stratocaster",
  "telecaster",
  "les-paul",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export type ProjectMode = "blank" | "import" | "template";
