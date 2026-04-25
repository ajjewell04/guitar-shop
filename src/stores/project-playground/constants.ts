import type {
  NumericNeckKey,
  NumericNeckMeta,
  TransformInputKey,
  TransformMode,
  NodeTransforms,
} from "./types";

export const ROTATION_MIN = -360;
export const ROTATION_MAX = 360;
export const SCALE_MIN = 0.01;
export const SCALE_MAX = 10;

export const DEFAULT_NODE_TRANSFORMS: NodeTransforms = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

export const TRANSFORM_MODES: TransformMode[] = [
  "translate",
  "rotate",
  "scale",
];

export const TRANSFORM_FIELDS: Array<{
  key: TransformInputKey;
  label: string;
  min?: number;
  max?: number;
  step: number;
}> = [
  { key: "positionX", label: "Position X", step: 0.01 },
  { key: "positionY", label: "Position Y", step: 0.01 },
  { key: "positionZ", label: "Position Z", step: 0.01 },
  {
    key: "rotationX",
    label: "Rotation X (deg)",
    min: ROTATION_MIN,
    max: ROTATION_MAX,
    step: 0.1,
  },
  {
    key: "rotationY",
    label: "Rotation Y (deg)",
    min: ROTATION_MIN,
    max: ROTATION_MAX,
    step: 0.1,
  },
  {
    key: "rotationZ",
    label: "Rotation Z (deg)",
    min: ROTATION_MIN,
    max: ROTATION_MAX,
    step: 0.1,
  },
  { key: "scale", label: "Scale", min: SCALE_MIN, max: SCALE_MAX, step: 0.01 },
];

export const TRANSFORM_FIELDS_BY_MODE: Record<
  TransformMode,
  TransformInputKey[]
> = {
  translate: ["positionX", "positionY", "positionZ"],
  rotate: ["rotationX", "rotationY", "rotationZ"],
  scale: ["scale"],
};

export const NUMERIC_NECK_META: Record<NumericNeckKey, NumericNeckMeta> = {
  scaleLengthIn: { label: "Scale Length (in)", min: 22.5, max: 27, step: 0.01 },
  fretCount: { label: "Fret Count", min: 20, max: 24, step: 1, integer: true },
  stringCount: {
    label: "String Count",
    min: 6,
    max: 8,
    step: 1,
    integer: true,
  },
  nutWidthMm: { label: "Nut Width (mm)", min: 38, max: 48, step: 0.1 },
  widthAtLastFretMm: {
    label: "Last Fret Width (mm)",
    min: 50,
    max: 62,
    step: 0.1,
  },
  fretboardThicknessNutMm: {
    label: "Board Thickness @ Nut (mm)",
    min: 4,
    max: 8,
    step: 0.1,
  },
  fretboardThicknessEndMm: {
    label: "Board Thickness @ End (mm)",
    min: 4,
    max: 9,
    step: 0.1,
  },
  fretboardOverhangMm: {
    label: "Board Overhang (mm)",
    min: 0,
    max: 20,
    step: 0.1,
  },
  fretboardSideMarginMm: {
    label: "Board Side Margin (mm)",
    min: 0,
    max: 4,
    step: 0.1,
  },
  nutThicknessMm: { label: "Nut Thickness (mm)", min: 2, max: 6, step: 0.1 },
  nutHeightMm: { label: "Nut Height (mm)", min: 3, max: 8, step: 0.1 },
  nutEdgeMarginMm: {
    label: "Nut Edge Margin (mm)",
    min: 1.5,
    max: 6,
    step: 0.1,
  },
  nutSlotWidthMm: {
    label: "Nut Slot Width (mm)",
    min: 0.5,
    max: 2.2,
    step: 0.1,
  },
  nutSlotDepthMm: { label: "Nut Slot Depth (mm)", min: 0.5, max: 4, step: 0.1 },
  fretCrownWidthMm: {
    label: "Fret Crown Width (mm)",
    min: 1.6,
    max: 3.2,
    step: 0.1,
  },
  fretCrownHeightMm: {
    label: "Fret Crown Height (mm)",
    min: 0.5,
    max: 1.8,
    step: 0.1,
  },
  fretEndInsetMm: { label: "Fret End Inset (mm)", min: 0, max: 3, step: 0.1 },
  thicknessAt1stMm: {
    label: "Thickness @ 1st (mm)",
    min: 18,
    max: 25,
    step: 0.1,
  },
  thicknessAt12thMm: {
    label: "Thickness @ 12th (mm)",
    min: 19,
    max: 27,
    step: 0.1,
  },
  asymmetryMm: { label: "Asymmetry (mm)", min: 0, max: 3, step: 0.1 },
  fingerboardRadiusStartIn: {
    label: "Radius Start (in)",
    min: 7.25,
    max: 20,
    step: 0.01,
  },
  fingerboardRadiusEndIn: {
    label: "Radius End (in)",
    min: 7.25,
    max: 20,
    step: 0.01,
  },
  heelWidthMm: { label: "Heel Width (mm)", min: 54, max: 58.5, step: 0.1 },
  heelLengthMm: {
    label: "Heel Length from Last Fret (mm)",
    min: 12,
    max: 40,
    step: 0.1,
  },
  heelThicknessMm: {
    label: "Heel Thickness (mm)",
    min: 20,
    max: 28,
    step: 0.1,
  },
  heelCornerRadiusMm: {
    label: "Heel Corner Radius (mm)",
    min: 0,
    max: 12,
    step: 0.1,
  },
  tiltbackAngleDeg: {
    label: "Tiltback Angle (deg)",
    min: 0,
    max: 17,
    step: 0.1,
  },
  neckAngleDeg: { label: "Neck Angle (deg)", min: -2, max: 5, step: 0.1 },
  headstockOffsetXMm: {
    label: "Headstock Offset X (mm)",
    min: -500,
    max: 500,
    step: 0.1,
  },
  headstockOffsetYMm: {
    label: "Headstock Offset Y (mm)",
    min: -500,
    max: 500,
    step: 0.1,
  },
  headstockOffsetZMm: {
    label: "Headstock Offset Z (mm)",
    min: -500,
    max: 500,
    step: 0.1,
  },
  headstockRotXDeg: {
    label: "Headstock Rot X (deg)",
    min: -360,
    max: 360,
    step: 0.1,
  },
  headstockRotYDeg: {
    label: "Headstock Rot Y (deg)",
    min: -360,
    max: 360,
    step: 0.1,
  },
  headstockRotZDeg: {
    label: "Headstock Rot Z (deg)",
    min: -360,
    max: 360,
    step: 0.1,
  },
  headstockScale: { label: "Headstock Scale", min: 0.01, max: 10, step: 0.01 },
};

export const NUMERIC_NECK_KEYS = Object.keys(
  NUMERIC_NECK_META,
) as NumericNeckKey[];

export const GENERAL_DIMENSION_NECK_KEYS: NumericNeckKey[] = [
  "scaleLengthIn",
  "stringCount",
  "nutWidthMm",
  "widthAtLastFretMm",
  "thicknessAt1stMm",
  "thicknessAt12thMm",
];
export const PROFILE_NUMERIC_NECK_KEYS: NumericNeckKey[] = ["asymmetryMm"];
export const FRETBOARD_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "fretboardThicknessNutMm",
  "fretboardThicknessEndMm",
  "fretboardOverhangMm",
  "fretboardSideMarginMm",
];
export const NUT_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "nutThicknessMm",
  "nutHeightMm",
  "nutEdgeMarginMm",
  "nutSlotWidthMm",
  "nutSlotDepthMm",
];
export const FRETS_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "fretCount",
  "fretCrownWidthMm",
  "fretCrownHeightMm",
  "fretEndInsetMm",
];
export const HEEL_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "heelWidthMm",
  "heelLengthMm",
  "heelThicknessMm",
  "heelCornerRadiusMm",
];
export const ALIGNMENT_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "tiltbackAngleDeg",
  "neckAngleDeg",
];
