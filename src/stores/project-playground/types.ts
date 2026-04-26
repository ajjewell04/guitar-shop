export type PartType =
  | "all"
  | "body"
  | "neck"
  | "headstock"
  | "bridge"
  | "tuning_machine"
  | "pickup"
  | "pickguard"
  | "knob"
  | "switch"
  | "strap_button"
  | "output_jack"
  | "miscellaneous";

export type SortKey = "asc" | "desc";

export type LibraryAsset = {
  id: string;
  name: string;
  part_type: string | null;
  upload_date?: string | null;
  previewUrl: string | null;
  modelUrl: string | null;
};

type Vec3 = { x: number; y: number; z: number };
export type NodeTransforms = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

export type ProjectNode = {
  id: string;
  name: string;
  type: "assembly" | "part";
  parent_id: string | null;
  sort_index: number;
  asset_id: string | null;
  transforms?: {
    position?: Vec3;
    rotation?: Vec3;
    scale?: number;
  } | null;
  asset?: {
    id: string;
    name: string;
    part_type: string | null;
    meta?: Record<string, unknown> | null;
    modelUrl: string | null;
    previewUrl: string | null;
  } | null;
};

export type ProjectNodesResponse = {
  project?: { id: string; root_node_id: string | null };
  nodes?: ProjectNode[];
  libraryAssets?: LibraryAsset[];
  error?: string;
};

export type ProjectNodeDeleteResponse = {
  ok?: boolean;
  rootCleared?: boolean;
  deletedNodeId?: string;
  error?: string;
};

export type PromoteProjectRootResponse = {
  ok?: boolean;
  projectId?: string;
  rootNodeId?: string;
  error?: string;
};

export type AssemblyWarning = {
  id: string;
  message: string;
};

export type NumericNeckKey =
  | "scaleLengthIn"
  | "fretCount"
  | "stringCount"
  | "nutWidthMm"
  | "widthAtLastFretMm"
  | "fretboardThicknessNutMm"
  | "fretboardThicknessEndMm"
  | "fretboardOverhangMm"
  | "fretboardSideMarginMm"
  | "nutThicknessMm"
  | "nutHeightMm"
  | "nutEdgeMarginMm"
  | "nutSlotWidthMm"
  | "nutSlotDepthMm"
  | "fretCrownWidthMm"
  | "fretCrownHeightMm"
  | "fretEndInsetMm"
  | "thicknessAt1stMm"
  | "thicknessAt12thMm"
  | "asymmetryMm"
  | "fingerboardRadiusStartIn"
  | "fingerboardRadiusEndIn"
  | "heelWidthMm"
  | "heelLengthMm"
  | "heelThicknessMm"
  | "heelCornerRadiusMm"
  | "tiltbackAngleDeg"
  | "neckAngleDeg"
  | "headstockOffsetXMm"
  | "headstockOffsetYMm"
  | "headstockOffsetZMm"
  | "headstockRotXDeg"
  | "headstockRotYDeg"
  | "headstockRotZDeg"
  | "headstockScale";

export type NumericNeckMeta = {
  label: string;
  min: number;
  max: number;
  step: number;
  integer?: true;
};

export type TransformMode = "translate" | "rotate" | "scale";
export type NeckTransformTarget = "neck" | "headstock";
export type TransformInputKey =
  | "positionX"
  | "positionY"
  | "positionZ"
  | "rotationX"
  | "rotationY"
  | "rotationZ"
  | "scale";
export type TransformInputDraft = Record<TransformInputKey, string>;

export type NodePatch = {
  parentId?: string | null;
  assetId?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
};
