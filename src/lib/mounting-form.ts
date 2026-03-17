import type { PartType } from "@/components/new-project/constants";
import type { AssetMounting, JointType, MountingAnchor } from "@/lib/mounting";

export type MountingFormDraft = {
  jointType: JointType | "";
  pocketWidthMm: string;
  pocketLengthMm: string;
  heelWidthMm: string;
  heelLengthMm: string;
  anchorPositionXmm: string;
  anchorPositionYmm: string;
  anchorPositionZmm: string;
  anchorRotationXDeg: string;
  anchorRotationYDeg: string;
  anchorRotationZDeg: string;
  anchorScaleX: string;
  anchorScaleY: string;
  anchorScaleZ: string;
};

export const DEFAULT_MOUNTING_FORM_DRAFT: MountingFormDraft = {
  jointType: "",
  pocketWidthMm: "",
  pocketLengthMm: "",
  heelWidthMm: "",
  heelLengthMm: "",
  anchorPositionXmm: "",
  anchorPositionYmm: "",
  anchorPositionZmm: "",
  anchorRotationXDeg: "",
  anchorRotationYDeg: "",
  anchorRotationZDeg: "",
  anchorScaleX: "",
  anchorScaleY: "",
  anchorScaleZ: "",
};

const JOINT_TYPE_DIMENSION_PRESETS: Record<
  JointType,
  { widthMm: number; lengthMm: number }
> = {
  bolt_on: { widthMm: 56, lengthMm: 24 },
  set_neck: { widthMm: 56, lengthMm: 28 },
  neck_through: { widthMm: 56, lengthMm: 40 },
};

const DEFAULT_ANCHOR_DRAFT_FIELDS: Pick<
  MountingFormDraft,
  | "anchorPositionXmm"
  | "anchorPositionYmm"
  | "anchorPositionZmm"
  | "anchorRotationXDeg"
  | "anchorRotationYDeg"
  | "anchorRotationZDeg"
  | "anchorScaleX"
  | "anchorScaleY"
  | "anchorScaleZ"
> = {
  anchorPositionXmm: "0",
  anchorPositionYmm: "0",
  anchorPositionZmm: "0",
  anchorRotationXDeg: "0",
  anchorRotationYDeg: "0",
  anchorRotationZDeg: "0",
  anchorScaleX: "1",
  anchorScaleY: "1",
  anchorScaleZ: "1",
};

export function getJointTypeAutofillPatch(
  partType: PartType | "",
  jointType: JointType | "",
): Partial<MountingFormDraft> {
  const basePatch: Partial<MountingFormDraft> = { jointType };
  if (!jointType || (partType !== "body" && partType !== "neck")) {
    return basePatch;
  }

  const preset = JOINT_TYPE_DIMENSION_PRESETS[jointType];
  if (partType === "body") {
    return {
      ...basePatch,
      ...DEFAULT_ANCHOR_DRAFT_FIELDS,
      pocketWidthMm: String(preset.widthMm),
      pocketLengthMm: String(preset.lengthMm),
    };
  }

  return {
    ...basePatch,
    ...DEFAULT_ANCHOR_DRAFT_FIELDS,
    heelWidthMm: String(preset.widthMm),
    heelLengthMm: String(preset.lengthMm),
  };
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function buildAnchorFromDraft(draft: MountingFormDraft): MountingAnchor | null {
  const hasAnyField = [
    draft.anchorPositionXmm,
    draft.anchorPositionYmm,
    draft.anchorPositionZmm,
    draft.anchorRotationXDeg,
    draft.anchorRotationYDeg,
    draft.anchorRotationZDeg,
    draft.anchorScaleX,
    draft.anchorScaleY,
    draft.anchorScaleZ,
  ].some((value) => value.trim() !== "");

  if (!hasAnyField) return null;

  return {
    positionMm: {
      x: parseOptionalNumber(draft.anchorPositionXmm) ?? 0,
      y: parseOptionalNumber(draft.anchorPositionYmm) ?? 0,
      z: parseOptionalNumber(draft.anchorPositionZmm) ?? 0,
    },
    rotationDeg: {
      x: parseOptionalNumber(draft.anchorRotationXDeg) ?? 0,
      y: parseOptionalNumber(draft.anchorRotationYDeg) ?? 0,
      z: parseOptionalNumber(draft.anchorRotationZDeg) ?? 0,
    },
    scale: {
      x: parseOptionalNumber(draft.anchorScaleX) ?? 1,
      y: parseOptionalNumber(draft.anchorScaleY) ?? 1,
      z: parseOptionalNumber(draft.anchorScaleZ) ?? 1,
    },
  };
}

export function toMountingPayload(
  partType: PartType | "",
  draft: MountingFormDraft,
): AssetMounting | undefined {
  if (partType !== "body" && partType !== "neck") return undefined;

  const payload: AssetMounting = {};
  const anchor = buildAnchorFromDraft(draft);
  const jointType = draft.jointType || undefined;
  if (jointType) payload.jointType = jointType;

  if (partType === "body") {
    const pocketWidthMm = parseOptionalNumber(draft.pocketWidthMm);
    const pocketLengthMm = parseOptionalNumber(draft.pocketLengthMm);
    if (pocketWidthMm !== null) payload.pocketWidthMm = pocketWidthMm;
    if (pocketLengthMm !== null) payload.pocketLengthMm = pocketLengthMm;
    if (anchor) payload.anchors = { neckPocket: anchor };
  } else {
    const heelWidthMm = parseOptionalNumber(draft.heelWidthMm);
    const heelLengthMm = parseOptionalNumber(draft.heelLengthMm);
    if (heelWidthMm !== null) payload.heelWidthMm = heelWidthMm;
    if (heelLengthMm !== null) payload.heelLengthMm = heelLengthMm;
    if (anchor) payload.anchors = { heel: anchor };
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}
