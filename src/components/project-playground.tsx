"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  Suspense,
  useCallback,
  type RefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Grid,
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
} from "@react-three/drei";
import type {
  OrbitControls as OrbitControlsImpl,
  TransformControls as TransformControlsImpl,
} from "three-stdlib";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  saveProjectPreview,
  toPreviewNodes,
} from "@/lib/project-preview-client";
import { PartFilters } from "@/components/ui/filters";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { renderModelPreview } from "@/lib/model-preview";
import {
  DEFAULT_NECK_PARAMS,
  normalizeNeckParams,
  type NeckParams,
} from "@/lib/neck-params";
import ProceduralNeckMesh, {
  type HeadstockLoadState,
} from "@/components/procedural-neck-mesh";

type PartType =
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

type SortKey = "asc" | "desc";

type ProjectPlaygroundProps = {
  projectId?: string;
  className?: string;
};

type LibraryAsset = {
  id: string;
  name: string;
  part_type: string | null;
  upload_date?: string | null;
  previewUrl: string | null;
  modelUrl: string | null;
};

type Vec3 = { x: number; y: number; z: number };
type NodeTransforms = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

type ProjectNode = {
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

type ProjectNodesResponse = {
  project?: { id: string; root_node_id: string | null };
  nodes?: ProjectNode[];
  libraryAssets?: LibraryAsset[];
  error?: string;
};

type ProjectNodeDeleteResponse = {
  ok?: boolean;
  rootCleared?: boolean;
  deletedNodeId?: string;
  error?: string;
};

type PromoteProjectRootResponse = {
  ok?: boolean;
  projectId?: string;
  rootNodeId?: string;
  error?: string;
};

type AssemblyWarning = {
  id: string;
  message: string;
};

type NumericNeckKey =
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

type NumericNeckMeta = {
  label: string;
  min: number;
  max: number;
  step: number;
  integer?: true;
};

type TransformMode = "translate" | "rotate" | "scale";
type NeckTransformTarget = "neck" | "headstock";
type TransformInputKey =
  | "positionX"
  | "positionY"
  | "positionZ"
  | "rotationX"
  | "rotationY"
  | "rotationZ"
  | "scale";
type TransformInputDraft = Record<TransformInputKey, string>;

const ROTATION_MIN = -360;
const ROTATION_MAX = 360;
const SCALE_MIN = 0.01;
const SCALE_MAX = 10;
const DEFAULT_NODE_TRANSFORMS: NodeTransforms = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};
const TRANSFORM_MODES: TransformMode[] = ["translate", "rotate", "scale"];
const TRANSFORM_FIELDS: Array<{
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
  {
    key: "scale",
    label: "Scale",
    min: SCALE_MIN,
    max: SCALE_MAX,
    step: 0.01,
  },
];
const TRANSFORM_FIELDS_BY_MODE: Record<TransformMode, TransformInputKey[]> = {
  translate: ["positionX", "positionY", "positionZ"],
  rotate: ["rotationX", "rotationY", "rotationZ"],
  scale: ["scale"],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampRotation(value: number) {
  return clamp(value, ROTATION_MIN, ROTATION_MAX);
}

function clampScale(value: number) {
  return clamp(value, SCALE_MIN, SCALE_MAX);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isObjectInSceneGraph(
  obj: THREE.Object3D | null,
): obj is THREE.Object3D {
  if (!obj) return false;
  let cursor: THREE.Object3D | null = obj;
  let depth = 0;
  while (cursor && depth < 256) {
    if ((cursor as THREE.Scene).isScene) return true;
    cursor = cursor.parent;
    depth += 1;
  }
  return false;
}

function normalizeNodeTransforms(
  transforms?: Partial<NodeTransforms> | null,
): NodeTransforms {
  const rawPos = transforms?.position;
  const rawRot = transforms?.rotation;
  return {
    position: {
      x: finiteNumber(rawPos?.x, DEFAULT_NODE_TRANSFORMS.position.x),
      y: finiteNumber(rawPos?.y, DEFAULT_NODE_TRANSFORMS.position.y),
      z: finiteNumber(rawPos?.z, DEFAULT_NODE_TRANSFORMS.position.z),
    },
    rotation: {
      x: clampRotation(
        finiteNumber(rawRot?.x, DEFAULT_NODE_TRANSFORMS.rotation.x),
      ),
      y: clampRotation(
        finiteNumber(rawRot?.y, DEFAULT_NODE_TRANSFORMS.rotation.y),
      ),
      z: clampRotation(
        finiteNumber(rawRot?.z, DEFAULT_NODE_TRANSFORMS.rotation.z),
      ),
    },
    scale: clampScale(
      finiteNumber(transforms?.scale, DEFAULT_NODE_TRANSFORMS.scale),
    ),
  };
}

function toTransformInputDraft(
  transforms: NodeTransforms,
): TransformInputDraft {
  return {
    positionX: String(transforms.position.x),
    positionY: String(transforms.position.y),
    positionZ: String(transforms.position.z),
    rotationX: String(transforms.rotation.x),
    rotationY: String(transforms.rotation.y),
    rotationZ: String(transforms.rotation.z),
    scale: String(transforms.scale),
  };
}

const NUMERIC_NECK_META: Record<NumericNeckKey, NumericNeckMeta> = {
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
  nutThicknessMm: {
    label: "Nut Thickness (mm)",
    min: 2,
    max: 6,
    step: 0.1,
  },
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
  nutSlotDepthMm: {
    label: "Nut Slot Depth (mm)",
    min: 0.5,
    max: 4,
    step: 0.1,
  },
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
  fretEndInsetMm: {
    label: "Fret End Inset (mm)",
    min: 0,
    max: 3,
    step: 0.1,
  },
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
  headstockScale: {
    label: "Headstock Scale",
    min: 0.01,
    max: 10,
    step: 0.01,
  },
};

const NUMERIC_NECK_KEYS = Object.keys(NUMERIC_NECK_META) as NumericNeckKey[];
const GENERAL_DIMENSION_NECK_KEYS: NumericNeckKey[] = [
  "scaleLengthIn",
  "stringCount",
  "nutWidthMm",
  "widthAtLastFretMm",
  "thicknessAt1stMm",
  "thicknessAt12thMm",
];
const PROFILE_NUMERIC_NECK_KEYS: NumericNeckKey[] = ["asymmetryMm"];
const FRETBOARD_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "fretboardThicknessNutMm",
  "fretboardThicknessEndMm",
  "fretboardOverhangMm",
  "fretboardSideMarginMm",
];
const NUT_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "nutThicknessMm",
  "nutHeightMm",
  "nutEdgeMarginMm",
  "nutSlotWidthMm",
  "nutSlotDepthMm",
];
const FRETS_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "fretCount",
  "fretCrownWidthMm",
  "fretCrownHeightMm",
  "fretEndInsetMm",
];
const HEEL_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "heelWidthMm",
  "heelLengthMm",
  "heelThicknessMm",
  "heelCornerRadiusMm",
];
const ALIGNMENT_NUMERIC_NECK_KEYS: NumericNeckKey[] = [
  "tiltbackAngleDeg",
  "neckAngleDeg",
];
function toNumericInputDraft(
  params: NeckParams,
): Record<NumericNeckKey, string> {
  return Object.fromEntries(
    NUMERIC_NECK_KEYS.map((k) => [k, String(params[k] as number)]),
  ) as Record<NumericNeckKey, string>;
}

function clampNeckNumber(key: NumericNeckKey, value: number) {
  const meta = NUMERIC_NECK_META[key];
  return clamp(value, meta.min, meta.max);
}

function neckParamsToHeadstockTransforms(params: NeckParams): NodeTransforms {
  return {
    position: {
      x: clampNeckNumber("headstockOffsetXMm", params.headstockOffsetXMm),
      y: clampNeckNumber("headstockOffsetYMm", params.headstockOffsetYMm),
      z: clampNeckNumber("headstockOffsetZMm", params.headstockOffsetZMm),
    },
    rotation: {
      x: clampNeckNumber("headstockRotXDeg", params.headstockRotXDeg),
      y: clampNeckNumber("headstockRotYDeg", params.headstockRotYDeg),
      z: clampNeckNumber("headstockRotZDeg", params.headstockRotZDeg),
    },
    scale: clampNeckNumber("headstockScale", params.headstockScale),
  };
}

function headstockTransformsToNeckPatch(
  transforms: NodeTransforms,
): Partial<NeckParams> {
  return {
    headstockOffsetXMm: clampNeckNumber(
      "headstockOffsetXMm",
      transforms.position.x,
    ),
    headstockOffsetYMm: clampNeckNumber(
      "headstockOffsetYMm",
      transforms.position.y,
    ),
    headstockOffsetZMm: clampNeckNumber(
      "headstockOffsetZMm",
      transforms.position.z,
    ),
    headstockRotXDeg: clampNeckNumber(
      "headstockRotXDeg",
      transforms.rotation.x,
    ),
    headstockRotYDeg: clampNeckNumber(
      "headstockRotYDeg",
      transforms.rotation.y,
    ),
    headstockRotZDeg: clampNeckNumber(
      "headstockRotZDeg",
      transforms.rotation.z,
    ),
    headstockScale: clampNeckNumber("headstockScale", transforms.scale),
  };
}

function ModelAssetView({
  url,
  nodeId,
  onLoaded,
  centerModel = true,
}: {
  url: string;
  nodeId: string;
  onLoaded: (nodeId: string) => void;
  centerModel?: boolean;
}) {
  const gltf = useGLTF(url) as unknown as GLTF;

  useEffect(() => {
    onLoaded(nodeId);
  }, [nodeId, onLoaded]);

  const centeredScene = useMemo(() => {
    const scene = gltf.scene.clone(true);
    if (centerModel) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      scene.position.sub(center);
    }
    return scene;
  }, [gltf.scene, centerModel]);

  return <primitive object={centeredScene} />;
}

function TransformControlsSync({
  controlsRef,
  object,
}: {
  controlsRef: RefObject<TransformControlsImpl | null>;
  object: THREE.Object3D | null;
}) {
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (object && isObjectInSceneGraph(object)) {
      controls.attach(object);
      return;
    }
    controls.detach();
  });

  return null;
}

export default function ProjectPlayground({
  projectId,
  className,
}: ProjectPlaygroundProps) {
  const [nodes, setNodes] = useState<ProjectNode[]>([]);
  const [projectRootNodeId, setProjectRootNodeId] = useState<string | null>(
    null,
  );
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [addingAssetId, setAddingAssetId] = useState<string | null>(null);
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [neckTransformTarget, setNeckTransformTarget] =
    useState<NeckTransformTarget>("neck");
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(
    null,
  );
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set());
  const [assetSearch, _setAssetSearch] = useState("");
  const [activePart, setActivePart] = useState<PartType>("all");
  const [assetSort, setAssetSort] = useState<SortKey>("asc");
  const [assemblyWarnings, setAssemblyWarnings] = useState<AssemblyWarning[]>(
    [],
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [neckDraftByNodeId, setNeckDraftByNodeId] = useState<
    Record<string, NeckParams>
  >({});
  const [savingNeckNodeId, setSavingNeckNodeId] = useState<string | null>(null);
  const [creatingNeck, setCreatingNeck] = useState(false);
  const [neckInputDraftByNodeId, setNeckInputDraftByNodeId] = useState<
    Record<string, Partial<Record<NumericNeckKey, string>>>
  >({});
  const [headstockLoadByNodeId, setHeadstockLoadByNodeId] = useState<
    Record<string, HeadstockLoadState>
  >({});
  const [transformInputDraftByNodeId, setTransformInputDraftByNodeId] =
    useState<Record<string, TransformInputDraft>>({});
  const [
    headstockTransformInputDraftByNodeId,
    setHeadstockTransformInputDraftByNodeId,
  ] = useState<Record<string, TransformInputDraft>>({});

  const nodeRefs = useRef<Record<string, THREE.Group | null>>({});
  const headstockTranslateRefs = useRef<Record<string, THREE.Group | null>>({});
  const headstockRotateScaleRefs = useRef<Record<string, THREE.Group | null>>(
    {},
  );
  const saveTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const transformRef = useRef<TransformControlsImpl | null>(null);
  const transformPointerDownRef = useRef(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const recenterRafRef = useRef<number | null>(null);

  const projectIdRef = useRef<string | undefined>(projectId);
  const projectRootNodeIdRef = useRef<string | null>(null);
  const nodesRef = useRef<ProjectNode[]>([]);
  const previewFlushInFlightRef = useRef<Promise<void> | null>(null);

  const resolveSelectedObject = useCallback(
    (
      nodeId: string | null,
      mode: TransformMode,
      neckTarget: NeckTransformTarget,
    ): THREE.Object3D | null => {
      if (!nodeId) return null;
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return null;
      const isNeck = node.asset?.part_type === "neck";
      if (!isNeck || neckTarget === "neck") {
        return nodeRefs.current[nodeId] ?? null;
      }
      if (mode === "translate") {
        return headstockTranslateRefs.current[nodeId] ?? null;
      }
      return headstockRotateScaleRefs.current[nodeId] ?? null;
    },
    [],
  );

  const expectedModelNodes = useMemo(
    () =>
      nodes
        .filter((n) => !!n.asset?.modelUrl && n.asset?.part_type !== "neck")
        .map((n) => n.id),
    [nodes],
  );

  const loadProgress = useMemo(() => {
    const total = expectedModelNodes.length;
    if (total === 0) return { total, loaded: 0, pct: 100 };
    let loaded = 0;
    for (const id of expectedModelNodes) {
      if (loadedNodeIds.has(id)) loaded++;
    }
    return { total, loaded, pct: Math.round((loaded / total) * 100) };
  }, [expectedModelNodes, loadedNodeIds]);
  const isModelLoading =
    loadProgress.total > 0 && loadProgress.loaded < loadProgress.total;
  const [hideModelLoadBadge, setHideModelLoadBadge] = useState(false);
  const [modelLoadBadgeTimedOut, setModelLoadBadgeTimedOut] = useState(false);

  useEffect(() => {
    setLoadedNodeIds(new Set());
  }, [expectedModelNodes.join("|")]);

  useEffect(() => {
    setHideModelLoadBadge(false);
    setModelLoadBadgeTimedOut(false);
  }, [expectedModelNodes.join("|")]);

  useEffect(() => {
    if (!isModelLoading) {
      setModelLoadBadgeTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setModelLoadBadgeTimedOut(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [isModelLoading, expectedModelNodes.join("|")]);

  const markNodeLoaded = useCallback((nodeId: string) => {
    setLoadedNodeIds((prev) => {
      if (prev.has(nodeId)) return prev;
      const next = new Set(prev);
      next.add(nodeId);
      return next;
    });
  }, []);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    projectRootNodeIdRef.current = projectRootNodeId;
  }, [projectRootNodeId]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    setSelectedObject(
      resolveSelectedObject(selectedNodeId, transformMode, neckTransformTarget),
    );
  }, [
    selectedNodeId,
    transformMode,
    neckTransformTarget,
    nodes,
    resolveSelectedObject,
  ]);

  async function loadFreshPreviewNodes(projectId: string) {
    const res = await fetch(`/api/projects/nodes?projectId=${projectId}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as ProjectNodesResponse;
    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to load nodes for preview");
    }
    return toPreviewNodes(data.nodes ?? []);
  }

  const flushProjectPreview = useCallback(() => {
    if (previewFlushInFlightRef.current) return;

    const currentProjectId = projectIdRef.current;
    if (!currentProjectId) return;

    previewFlushInFlightRef.current = (async () => {
      await flushPendingNodeSaves();
      let previewNodes = toPreviewNodes(nodesRef.current);
      try {
        previewNodes = await loadFreshPreviewNodes(currentProjectId);
      } catch {
        // Fall back to in-memory nodes if refresh fails.
      }
      if (!previewNodes.length) return;
      await saveProjectPreview(currentProjectId, previewNodes);
      window.dispatchEvent(new Event("projects-changed"));
    })()
      .catch(() => {
        // Best effort on leave
      })
      .finally(() => {
        previewFlushInFlightRef.current = null;
      });
  }, []);

  useEffect(() => {
    const onPageHide = () => flushProjectPreview();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushProjectPreview();
    };

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushProjectPreview]);

  useEffect(() => {
    const onWorkviewExit = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== projectIdRef.current)
        return;
      flushProjectPreview();
    };

    window.addEventListener("project-workview-exit", onWorkviewExit);
    return () => {
      window.removeEventListener("project-workview-exit", onWorkviewExit);
    };
  }, [flushProjectPreview]);

  useEffect(() => {
    return () => {
      flushProjectPreview();
    };
  }, [flushProjectPreview]);

  const getObjectWorldCenter = useCallback((obj: THREE.Object3D) => {
    obj.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  }, []);

  const shouldIgnoreSceneSelection = useCallback(() => {
    const controls = transformRef.current;
    if (!controls) return false;
    const controlState = controls as unknown as {
      dragging?: boolean;
      axis?: string | null;
    };
    return (
      transformPointerDownRef.current ||
      controlState.dragging === true ||
      (controlState.axis ?? null) !== null
    );
  }, []);

  const recenterCameraTo = useCallback(
    (nextTarget: THREE.Vector3, animate = true) => {
      const camera = cameraRef.current;
      const controls = orbitRef.current;
      if (!camera || !controls) return;

      const startTarget = controls.target.clone();
      const delta = nextTarget.clone().sub(startTarget);

      if (delta.lengthSq() < 1e-12) return;

      const startPos = camera.position.clone();
      const endTarget = startTarget.clone().add(delta);
      const endPos = startPos.clone().add(delta);

      if (recenterRafRef.current) {
        window.cancelAnimationFrame(recenterRafRef.current);
        recenterRafRef.current = null;
      }

      if (!animate) {
        camera.position.copy(endPos);
        controls.target.copy(endTarget);
        controls.update();
        return;
      }

      const durationMs = 260;
      const t0 = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const tick = (now: number) => {
        const p = Math.min((now - t0) / durationMs, 1);
        const e = easeOutCubic(p);

        camera.position.lerpVectors(startPos, endPos, e);
        controls.target.lerpVectors(startTarget, endTarget, e);
        controls.update();

        if (p < 1) {
          recenterRafRef.current = window.requestAnimationFrame(tick);
        } else {
          recenterRafRef.current = null;
        }
      };

      recenterRafRef.current = window.requestAnimationFrame(tick);
    },
    [],
  );

  const recenterToSelectedNode = useCallback(
    (animate = true) => {
      if (!selectedNodeId) return;
      const obj = nodeRefs.current[selectedNodeId];
      if (!obj) return;
      const center = getObjectWorldCenter(obj);
      recenterCameraTo(center, animate);
    },
    [selectedNodeId, getObjectWorldCenter, recenterCameraTo],
  );

  useEffect(() => {
    return () => {
      if (recenterRafRef.current) {
        window.cancelAnimationFrame(recenterRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedNodeId) return;
    const raf = window.requestAnimationFrame(() => {
      recenterToSelectedNode(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [selectedNodeId, recenterToSelectedNode]);

  async function loadProjectData(
    preferredNodeId?: string,
  ): Promise<ProjectNode[]> {
    if (!projectId) {
      setNodes([]);
      setProjectRootNodeId(null);
      projectRootNodeIdRef.current = null;
      setLibraryAssets([]);
      setSelectedNodeId(null);
      setStatus("idle");
      return [];
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/projects/nodes?projectId=${projectId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ProjectNodesResponse;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load project nodes");
      }

      const nextNodes = data.nodes ?? [];
      setNodes(nextNodes);
      setProjectRootNodeId(data.project?.root_node_id ?? null);
      projectRootNodeIdRef.current = data.project?.root_node_id ?? null;
      setLibraryAssets(data.libraryAssets ?? []);

      setSelectedNodeId((prev) => {
        if (
          preferredNodeId &&
          nextNodes.some((n) => n.id === preferredNodeId)
        ) {
          return preferredNodeId;
        }

        if (prev && nextNodes.some((n) => n.id === prev)) {
          return prev;
        }

        return nextNodes.length > 0 ? nextNodes[0].id : null;
      });

      setStatus("idle");
      return nextNodes;
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Load failed.");
      return [];
    }
  }

  useEffect(() => {
    void loadProjectData();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, [projectId]);

  function showToast(message: string) {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3500);
  }

  function findPartNode(rows: ProjectNode[], partType: string) {
    return rows.find((node) => node.asset?.part_type === partType) ?? null;
  }

  function getRequiredParentPartType(
    partType: string | null,
  ): "body" | "neck" | null {
    if (partType === "bridge" || partType === "pickup") return "body";
    if (partType === "tuning_machine") return "neck";
    return null;
  }

  async function promoteBodyNodeToRoot(bodyNodeId: string) {
    if (!projectId) throw new Error("Missing project id");
    const res = await fetch("/api/projects/root", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, newRootNodeId: bodyNodeId }),
    });
    const payload = (await res
      .json()
      .catch(() => ({}))) as PromoteProjectRootResponse;
    if (!res.ok) {
      throw new Error(
        payload?.error ?? "Failed to promote body to project root",
      );
    }
  }

  async function patchProjectNode(
    nodeId: string,
    patch: {
      parentId?: string | null;
      assetId?: string;
      position?: Vec3;
      rotation?: Vec3;
      scale?: number;
    },
  ) {
    const res = await fetch("/api/projects/nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, ...patch }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? "Project node update failed");
    }
  }

  async function ensureBodyNeckPairing(nextNodes: ProjectNode[]) {
    let currentNodes = nextNodes;
    let bodyNode = findPartNode(currentNodes, "body");
    let neckNode = findPartNode(currentNodes, "neck");

    if (!bodyNode || !neckNode) {
      setAssemblyWarnings([]);
      return currentNodes;
    }

    if (projectRootNodeIdRef.current !== bodyNode.id) {
      await promoteBodyNodeToRoot(bodyNode.id);
      currentNodes = await loadProjectData(bodyNode.id);
      bodyNode = findPartNode(currentNodes, "body");
      neckNode = findPartNode(currentNodes, "neck");
      if (!bodyNode || !neckNode) return currentNodes;
    }

    if (neckNode.parent_id === bodyNode.id) {
      setAssemblyWarnings([]);
      return currentNodes;
    }

    setSelectedObject(null);

    await patchProjectNode(neckNode.id, {
      parentId: bodyNode.id,
    });

    setAssemblyWarnings([]);

    return loadProjectData(neckNode.id);
  }

  async function addAssetToProject(
    assetId: string,
    partTypeHint?: string | null,
  ): Promise<string | null> {
    if (!projectId) return null;
    const sourceAsset = libraryAssets.find((asset) => asset.id === assetId);
    const sourcePartType = sourceAsset?.part_type ?? partTypeHint ?? null;

    setAddingAssetId(assetId);
    setErrorMessage(null);

    try {
      let resultNodeId: string | null = null;
      let nextNodes: ProjectNode[] = [];
      const isBodyOrNeck =
        sourcePartType === "body" || sourcePartType === "neck";
      const requiredParentPartType = getRequiredParentPartType(sourcePartType);
      const requiredParentNode = requiredParentPartType
        ? findPartNode(nodesRef.current, requiredParentPartType)
        : null;

      const createProjectNode = async (parentId?: string) => {
        const requestBody: {
          projectId: string;
          assetId: string;
          parentId?: string;
        } = {
          projectId,
          assetId,
        };
        if (parentId) requestBody.parentId = parentId;

        const res = await fetch("/api/projects/nodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to add asset to project");
        }

        return typeof data?.node?.id === "string" ? data.node.id : null;
      };

      if (isBodyOrNeck) {
        const existingNode = findPartNode(nodesRef.current, sourcePartType);
        if (existingNode) {
          const confirmed = window.confirm(
            `This project already has a ${sourcePartType}. Replace it with "${sourceAsset?.name ?? "selected asset"}"?`,
          );
          if (!confirmed) return null;

          await patchProjectNode(existingNode.id, { assetId });
          clearNodeLocalDraftState(existingNode.id);
          resultNodeId = existingNode.id;
          nextNodes = await loadProjectData(existingNode.id);
        } else {
          resultNodeId = await createProjectNode();
          nextNodes = await loadProjectData(resultNodeId ?? undefined);
        }

        nextNodes = await ensureBodyNeckPairing(nextNodes);
        const counterpart = sourcePartType === "body" ? "neck" : "body";
        if (!findPartNode(nextNodes, counterpart)) {
          showToast(
            `Added ${sourcePartType}. Add a ${counterpart} to auto-attach.`,
          );
        }
      } else if (sourcePartType === "bridge") {
        const existingBridgeNode = findPartNode(nodesRef.current, "bridge");
        if (existingBridgeNode) {
          const confirmed = window.confirm(
            `This project already has a bridge. Replace it with "${sourceAsset?.name ?? "selected asset"}"?`,
          );
          if (!confirmed) return null;

          await patchProjectNode(existingBridgeNode.id, { assetId });
          resultNodeId = existingBridgeNode.id;
          nextNodes = await loadProjectData(existingBridgeNode.id);
        } else {
          resultNodeId = await createProjectNode(requiredParentNode?.id);
          nextNodes = await loadProjectData(resultNodeId ?? undefined);
          if (requiredParentPartType && !requiredParentNode) {
            showToast(
              "Added bridge without a body parent. Add a body to attach it.",
            );
          }
        }
      } else {
        resultNodeId = await createProjectNode(requiredParentNode?.id);
        nextNodes = await loadProjectData(resultNodeId ?? undefined);

        if (requiredParentPartType && !requiredParentNode) {
          const partLabel = sourcePartType?.replace(/_/g, " ") ?? "part";
          showToast(
            `Added ${partLabel} without a ${requiredParentPartType} parent. Add a ${requiredParentPartType} to attach it.`,
          );
        }
      }

      if (!resultNodeId) {
        const byAsset =
          nextNodes.find((n) => n.asset_id === assetId)?.id ?? null;
        if (byAsset) setSelectedNodeId(byAsset);
        return byAsset;
      }

      return resultNodeId;
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to add asset.",
      );
      setStatus("error");
      return null;
    } finally {
      setAddingAssetId(null);
    }
  }

  async function deleteSelectedModel() {
    const nodeId = selectedNodeId;
    if (!nodeId) return;

    setDeletingNodeId(nodeId);
    setErrorMessage(null);

    try {
      await flushPendingNodeSaves();

      const res = await fetch("/api/projects/nodes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      const payload = (await res
        .json()
        .catch(() => ({}))) as ProjectNodeDeleteResponse;

      if (!res.ok) {
        throw new Error(
          payload?.error ?? "Failed to delete model from this project.",
        );
      }

      if (typeof payload.deletedNodeId === "string") {
        clearNodeLocalDraftState(payload.deletedNodeId);
      }

      await loadProjectData();
      setSelectedNodeId(null);
      setSelectedObject(null);
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "Failed to delete selected model.",
      );
      setStatus("error");
    } finally {
      setDeletingNodeId(null);
    }
  }

  const pendingNodeTransformsRef = useRef<Map<string, NodeTransforms>>(
    new Map(),
  );

  function clearNodeLocalDraftState(nodeId: string) {
    nodeRefs.current[nodeId] = null;
    headstockTranslateRefs.current[nodeId] = null;
    headstockRotateScaleRefs.current[nodeId] = null;
    pendingNodeTransformsRef.current.delete(nodeId);

    setTransformInputDraftByNodeId((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setNeckDraftByNodeId((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setNeckInputDraftByNodeId((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setHeadstockLoadByNodeId((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setHeadstockTransformInputDraftByNodeId((prev) => {
      if (!(nodeId in prev)) return prev;
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }

  function applyLocalNodeTransforms(
    nodeId: string,
    transforms: NodeTransforms,
  ) {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              transforms: {
                ...(n.transforms ?? {}),
                position: transforms.position,
                rotation: transforms.rotation,
                scale: transforms.scale,
              },
            }
          : n,
      );
      nodesRef.current = next;
      return next;
    });
    setTransformInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: toTransformInputDraft(transforms),
    }));
  }

  async function persistNodeTransforms(
    nodeId: string,
    transforms: NodeTransforms,
  ) {
    const res = await fetch("/api/projects/nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        position: transforms.position,
        rotation: transforms.rotation,
        scale: transforms.scale,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? "Save failed.");
    }
  }

  function scheduleTransformSave(
    nodeId: string | null,
    transforms: NodeTransforms | null,
  ) {
    if (!nodeId || !transforms) return;

    applyLocalNodeTransforms(nodeId, transforms);
    pendingNodeTransformsRef.current.set(nodeId, transforms);

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      const pending = Array.from(pendingNodeTransformsRef.current.entries());
      pendingNodeTransformsRef.current.clear();
      try {
        await Promise.all(
          pending.map(([id, nextTransforms]) =>
            persistNodeTransforms(id, nextTransforms),
          ),
        );
      } catch {
        /* empty */
      }
    }, 300);
  }

  async function flushPendingNodeSaves() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = Array.from(pendingNodeTransformsRef.current.entries());
    if (!pending.length) return;
    pendingNodeTransformsRef.current.clear();
    await Promise.all(
      pending.map(([id, nextTransforms]) =>
        persistNodeTransforms(id, nextTransforms),
      ),
    );
  }

  const loadedModelCount = useMemo(
    () => nodes.filter((node) => !!node.asset?.modelUrl).length,
    [nodes],
  );

  const statusLabel = useMemo(() => {
    if (status === "loading") return "Loading project...";
    if (status === "error")
      return errorMessage ?? "Unable to load project data.";
    if (loadedModelCount === 0) return "No models in project yet.";
    return `${loadedModelCount} model${loadedModelCount === 1 ? "" : "s"} in project`;
  }, [status, errorMessage, loadedModelCount]);

  const visibleLibraryAssets = useMemo(() => {
    const q = assetSearch.toLowerCase().trim();
    let rows = [...libraryAssets];

    if (activePart !== "all") {
      rows = rows.filter((asset) => asset.part_type === activePart);
    }

    if (q) {
      rows = rows.filter((asset) => {
        const partLabel = asset.part_type?.replace(/_/g, " ");
        return (
          asset.name.toLowerCase().includes(q) ||
          partLabel?.toLowerCase().includes(q)
        );
      });
    }

    rows.sort((a, b) => {
      const ta = new Date(a.upload_date ?? 0).getTime();
      const tb = new Date(b.upload_date ?? 0).getTime();
      return assetSort === "desc" ? ta - tb : tb - ta;
    });

    return rows;
  }, [libraryAssets, assetSearch, activePart, assetSort]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedNodeTransforms = useMemo(
    () => normalizeNodeTransforms(selectedNode?.transforms),
    [selectedNode],
  );

  const selectedNeckNode = useMemo(() => {
    if (!selectedNode?.asset) return null;
    if (selectedNode.asset.part_type !== "neck") return null;
    return selectedNode;
  }, [selectedNode]);
  const selectedBodyOrNeckNode = useMemo(() => {
    const partType = selectedNode?.asset?.part_type;
    return partType === "body" || partType === "neck";
  }, [selectedNode]);

  useEffect(() => {
    const hasBody = nodes.some((node) => node.asset?.part_type === "body");
    const hasNeck = nodes.some((node) => node.asset?.part_type === "neck");
    if (!hasBody || !hasNeck) {
      setAssemblyWarnings([]);
    }
  }, [nodes]);

  useEffect(() => {
    if (!selectedNode?.id) return;
    setTransformInputDraftByNodeId((prev) => {
      if (prev[selectedNode.id]) return prev;
      return {
        ...prev,
        [selectedNode.id]: toTransformInputDraft(selectedNodeTransforms),
      };
    });
  }, [selectedNode, selectedNodeTransforms]);

  useEffect(() => {
    if (selectedNodeId) return;
    setSelectedObject(null);
  }, [selectedNodeId]);

  const headstockAssets = useMemo(
    () => libraryAssets.filter((a) => a.part_type === "headstock"),
    [libraryAssets],
  );
  const headstockAssetById = useMemo(
    () => new Map(headstockAssets.map((asset) => [asset.id, asset])),
    [headstockAssets],
  );

  const getHeadstockRenderState = useCallback(
    (params: NeckParams | null) => {
      if (!params?.headstockAssetId) {
        return {
          asset: null as LibraryAsset | null,
          url: null as string | null,
          unavailableError: null as string | null,
        };
      }

      const asset = headstockAssetById.get(params.headstockAssetId) ?? null;
      const url = asset?.modelUrl ?? null;
      let unavailableError: string | null = null;
      if (!asset) {
        unavailableError =
          "Selected headstock is not available in your library.";
      } else if (!url) {
        unavailableError = "Selected headstock does not have a model file yet.";
      }

      return { asset, url, unavailableError };
    },
    [headstockAssetById],
  );

  const selectedNeckParams = useMemo(
    () => (selectedNeckNode ? getNeckParamsForNode(selectedNeckNode) : null),
    [selectedNeckNode, neckDraftByNodeId],
  );
  const selectedNeckHeadstockState = useMemo(
    () => getHeadstockRenderState(selectedNeckParams),
    [getHeadstockRenderState, selectedNeckParams],
  );
  const canTargetSelectedHeadstock = useMemo(
    () =>
      !!selectedNeckParams?.headstockAssetId &&
      !!selectedNeckHeadstockState.url &&
      !selectedNeckHeadstockState.unavailableError,
    [selectedNeckHeadstockState, selectedNeckParams],
  );

  useEffect(() => {
    if (!selectedNeckNode && neckTransformTarget !== "neck") {
      setNeckTransformTarget("neck");
      return;
    }
    if (
      selectedNeckNode &&
      neckTransformTarget === "headstock" &&
      !canTargetSelectedHeadstock
    ) {
      setNeckTransformTarget("neck");
    }
  }, [canTargetSelectedHeadstock, neckTransformTarget, selectedNeckNode]);

  useEffect(() => {
    if (!selectedNeckNode?.id) return;
    setNeckDraftByNodeId((prev) => {
      if (prev[selectedNeckNode.id]) return prev;
      const raw = (selectedNeckNode.asset?.meta as { neck?: unknown } | null)
        ?.neck;
      const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
      return { ...prev, [selectedNeckNode.id]: params };
    });

    setNeckInputDraftByNodeId((prev) => {
      if (prev[selectedNeckNode.id]) return prev;
      const raw = (selectedNeckNode.asset?.meta as { neck?: unknown } | null)
        ?.neck;
      const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
      return { ...prev, [selectedNeckNode.id]: toNumericInputDraft(params) };
    });

    setHeadstockTransformInputDraftByNodeId((prev) => {
      if (prev[selectedNeckNode.id]) return prev;
      const raw = (selectedNeckNode.asset?.meta as { neck?: unknown } | null)
        ?.neck;
      const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
      return {
        ...prev,
        [selectedNeckNode.id]: toTransformInputDraft(
          neckParamsToHeadstockTransforms(params),
        ),
      };
    });
  }, [selectedNeckNode]);

  function updateNeckDraft(nodeId: string, patch: Partial<NeckParams>) {
    setNeckDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: normalizeNeckParams({
        ...(prev[nodeId] ?? DEFAULT_NECK_PARAMS),
        ...patch,
      }),
    }));
  }

  const setHeadstockLoadState = useCallback(
    (nodeId: string, next: HeadstockLoadState) => {
      setHeadstockLoadByNodeId((prev) => {
        const current = prev[nodeId];
        const nextMessage = next.message ?? null;
        const currentMessage = current?.message ?? null;
        if (current?.status === next.status && currentMessage === nextMessage) {
          return prev;
        }
        return {
          ...prev,
          [nodeId]: { status: next.status, message: nextMessage },
        };
      });
    },
    [],
  );

  async function createParameterizedNeck() {
    if (!projectId || creatingNeck) return;

    setCreatingNeck(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/assets/neck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Parametric Neck" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.assetId) {
        throw new Error(payload?.error ?? "Failed to create neck");
      }

      const createdNodeId = await addAssetToProject(payload.assetId, "neck");

      setActivePart("neck");
      if (createdNodeId) {
        setNeckDraftByNodeId((prev) =>
          prev[createdNodeId]
            ? prev
            : { ...prev, [createdNodeId]: DEFAULT_NECK_PARAMS },
        );
        setSelectedNodeId(createdNodeId);
      }

      window.dispatchEvent(new Event("assets-changed"));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to create neck");
    } finally {
      setCreatingNeck(false);
    }
  }

  function getNeckParamsForNode(node: ProjectNode): NeckParams | null {
    if (node.asset?.part_type !== "neck") return null;
    const draft = neckDraftByNodeId[node.id];
    if (draft) return draft;
    const raw = (node.asset?.meta as { neck?: unknown } | null)?.neck;
    return raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
  }

  function getHeadstockTransformsForNode(nodeId: string): NodeTransforms {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || node.asset?.part_type !== "neck") {
      return DEFAULT_NODE_TRANSFORMS;
    }
    const params = getNeckParamsForNode(node) ?? DEFAULT_NECK_PARAMS;
    return neckParamsToHeadstockTransforms(params);
  }

  function applyHeadstockTransformsToDraft(
    nodeId: string,
    transforms: NodeTransforms,
  ) {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    const raw = (node?.asset?.meta as { neck?: unknown } | null)?.neck;
    const fallbackParams = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
    const clampedTransforms: NodeTransforms = {
      position: {
        x: clampNeckNumber("headstockOffsetXMm", transforms.position.x),
        y: clampNeckNumber("headstockOffsetYMm", transforms.position.y),
        z: clampNeckNumber("headstockOffsetZMm", transforms.position.z),
      },
      rotation: {
        x: clampNeckNumber("headstockRotXDeg", transforms.rotation.x),
        y: clampNeckNumber("headstockRotYDeg", transforms.rotation.y),
        z: clampNeckNumber("headstockRotZDeg", transforms.rotation.z),
      },
      scale: clampNeckNumber("headstockScale", transforms.scale),
    };
    const patch = headstockTransformsToNeckPatch(clampedTransforms);

    setNeckDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: normalizeNeckParams({
        ...(prev[nodeId] ?? fallbackParams),
        ...patch,
      }),
    }));
    setNeckInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ?? {}),
        headstockOffsetXMm: String(patch.headstockOffsetXMm),
        headstockOffsetYMm: String(patch.headstockOffsetYMm),
        headstockOffsetZMm: String(patch.headstockOffsetZMm),
        headstockRotXDeg: String(patch.headstockRotXDeg),
        headstockRotYDeg: String(patch.headstockRotYDeg),
        headstockRotZDeg: String(patch.headstockRotZDeg),
        headstockScale: String(patch.headstockScale),
      },
    }));
    setHeadstockTransformInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: toTransformInputDraft(clampedTransforms),
    }));
  }

  function snapshotHeadstockTransformsFromObjects(
    nodeId: string,
    mode: TransformMode,
  ): NodeTransforms {
    const current = getHeadstockTransformsForNode(nodeId);
    const translateObj = headstockTranslateRefs.current[nodeId];
    const rotateScaleObj = headstockRotateScaleRefs.current[nodeId];

    const position = { ...current.position };
    if (translateObj) {
      position.x = clampNeckNumber(
        "headstockOffsetXMm",
        translateObj.position.x,
      );
      position.y = clampNeckNumber(
        "headstockOffsetYMm",
        translateObj.position.y,
      );
      position.z = clampNeckNumber(
        "headstockOffsetZMm",
        translateObj.position.z,
      );
      translateObj.position.set(position.x, position.y, position.z);
    }

    const rotation = { ...current.rotation };
    let scale = current.scale;
    if (rotateScaleObj) {
      rotation.x = clampNeckNumber(
        "headstockRotXDeg",
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.x),
      );
      rotation.y = clampNeckNumber(
        "headstockRotYDeg",
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.y),
      );
      rotation.z = clampNeckNumber(
        "headstockRotZDeg",
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.z),
      );
      rotateScaleObj.rotation.set(
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z),
      );

      scale = clampNeckNumber(
        "headstockScale",
        mode === "scale"
          ? getActiveAxisUniformScale(rotateScaleObj)
          : rotateScaleObj.scale.x,
      );
      rotateScaleObj.scale.setScalar(scale);
    }

    return { position, rotation, scale };
  }

  async function exportGroupToGlb(group: THREE.Group): Promise<File> {
    const exporter = new GLTFExporter();
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        group,
        (res) =>
          res instanceof ArrayBuffer
            ? resolve(res)
            : reject(new Error("GLB export failed")),
        (err) => reject(err),
        { binary: true },
      );
    });
    return new File([buffer], "generated-neck.glb", {
      type: "model/gltf-binary",
    });
  }

  async function applyAndSaveNeck(node: ProjectNode) {
    if (!node.asset?.id) return;
    const draft = neckDraftByNodeId[node.id];
    if (!draft) return;
    if (!draft.headstockAssetId) {
      setErrorMessage("Please select a headstock asset.");
      return;
    }

    const headstockLoad = headstockLoadByNodeId[node.id];
    if (!headstockLoad || headstockLoad.status !== "ready") {
      if (headstockLoad?.status === "loading") {
        setErrorMessage("Headstock model is still loading.");
        return;
      }
      setErrorMessage(
        headstockLoad?.message ?? "Headstock model is not ready.",
      );
      return;
    }

    const group = nodeRefs.current[node.id];
    if (!group) throw new Error("Neck object not ready");

    setSavingNeckNodeId(node.id);
    setErrorMessage(null);

    try {
      const glbFile = await exportGroupToGlb(group);
      const previewBlob = await renderModelPreview(glbFile);

      const presignRes = await fetch("/api/assets/neck/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: node.asset.id }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok)
        throw new Error(presign?.error ?? "Neck presign failed");

      await fetch(presign.model.url, {
        method: "PUT",
        headers: { "Content-Type": presign.model.contentType },
        body: glbFile,
      });

      await fetch(presign.preview.url, {
        method: "PUT",
        headers: { "Content-Type": presign.preview.contentType },
        body: previewBlob,
      });

      const saveRes = await fetch("/api/assets/neck/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: node.asset.id,
          neckParams: draft,
          modelObjectKey: presign.model.objectKey,
          modelBytes: glbFile.size,
          previewObjectKey: presign.preview.objectKey,
          previewBytes: previewBlob.size,
        }),
      });
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok)
        throw new Error(savePayload?.error ?? "Neck save failed");

      await loadProjectData();
      window.dispatchEvent(new Event("assets-changed"));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to save neck");
    } finally {
      setSavingNeckNodeId(null);
    }
  }

  function resetNeckDraft(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    const raw = (node?.asset?.meta as { neck?: unknown } | null)?.neck;
    const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;

    setNeckDraftByNodeId((prev) => ({ ...prev, [nodeId]: params }));
    setNeckInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: toNumericInputDraft(params),
    }));
    setHeadstockTransformInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: toTransformInputDraft(neckParamsToHeadstockTransforms(params)),
    }));
  }

  function setNeckNumberInput(
    nodeId: string,
    key: NumericNeckKey,
    raw: string,
  ) {
    setNeckInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] ?? {}), [key]: raw },
    }));
  }

  function commitNeckNumberInput(nodeId: string, key: NumericNeckKey) {
    const raw = neckInputDraftByNodeId[nodeId]?.[key];
    const current = neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
    const currentValid = current[key] as number;

    if (raw == null || raw.trim() === "") {
      setNeckNumberInput(nodeId, key, String(currentValid));
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setNeckNumberInput(nodeId, key, String(currentValid));
      return;
    }

    const meta = NUMERIC_NECK_META[key];
    let next = Math.min(meta.max, Math.max(meta.min, parsed));
    if (meta.integer) next = Math.round(next);

    const nextParams = normalizeNeckParams({ ...current, [key]: next });

    setNeckDraftByNodeId((prev) => ({ ...prev, [nodeId]: nextParams }));
    setNeckInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: toNumericInputDraft(nextParams),
    }));
  }

  function getNodeTransformsById(nodeId: string): NodeTransforms {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    return normalizeNodeTransforms(node?.transforms);
  }

  function updateTransformsByInputKey(
    transforms: NodeTransforms,
    key: TransformInputKey,
    value: number,
  ): NodeTransforms {
    if (key === "positionX") {
      return {
        ...transforms,
        position: { ...transforms.position, x: value },
      };
    }
    if (key === "positionY") {
      return {
        ...transforms,
        position: { ...transforms.position, y: value },
      };
    }
    if (key === "positionZ") {
      return {
        ...transforms,
        position: { ...transforms.position, z: value },
      };
    }
    if (key === "rotationX") {
      return {
        ...transforms,
        rotation: { ...transforms.rotation, x: clampRotation(value) },
      };
    }
    if (key === "rotationY") {
      return {
        ...transforms,
        rotation: { ...transforms.rotation, y: clampRotation(value) },
      };
    }
    if (key === "rotationZ") {
      return {
        ...transforms,
        rotation: { ...transforms.rotation, z: clampRotation(value) },
      };
    }
    return { ...transforms, scale: clampScale(value) };
  }

  function setTransformInputValue(
    nodeId: string,
    key: TransformInputKey,
    raw: string,
  ) {
    setTransformInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ??
          toTransformInputDraft(getNodeTransformsById(nodeId))),
        [key]: raw,
      },
    }));
  }

  function commitTransformInput(nodeId: string, key: TransformInputKey) {
    const raw = transformInputDraftByNodeId[nodeId]?.[key];
    const current = getNodeTransformsById(nodeId);
    const currentDraft = toTransformInputDraft(current);
    if (raw == null || raw.trim() === "") {
      setTransformInputValue(nodeId, key, currentDraft[key]);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setTransformInputValue(nodeId, key, currentDraft[key]);
      return;
    }
    const next = updateTransformsByInputKey(current, key, parsed);
    scheduleTransformSave(nodeId, next);
  }

  function setHeadstockTransformInputValue(
    nodeId: string,
    key: TransformInputKey,
    raw: string,
  ) {
    setHeadstockTransformInputDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] ??
          toTransformInputDraft(getHeadstockTransformsForNode(nodeId))),
        [key]: raw,
      },
    }));
  }

  function commitHeadstockTransformInput(
    nodeId: string,
    key: TransformInputKey,
  ) {
    const raw = headstockTransformInputDraftByNodeId[nodeId]?.[key];
    const current = getHeadstockTransformsForNode(nodeId);
    const currentDraft = toTransformInputDraft(current);
    if (raw == null || raw.trim() === "") {
      setHeadstockTransformInputValue(nodeId, key, currentDraft[key]);
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setHeadstockTransformInputValue(nodeId, key, currentDraft[key]);
      return;
    }
    const next = updateTransformsByInputKey(current, key, parsed);
    applyHeadstockTransformsToDraft(nodeId, next);
  }

  function getActiveAxisUniformScale(obj: THREE.Object3D) {
    const axis =
      (transformRef.current as unknown as { axis?: string | null } | null)
        ?.axis ?? "";
    if (axis.includes("X")) return obj.scale.x;
    if (axis.includes("Y")) return obj.scale.y;
    if (axis.includes("Z")) return obj.scale.z;
    return obj.scale.x;
  }

  function snapshotNodeTransformsFromObject(
    obj: THREE.Object3D,
    mode: TransformMode,
  ): NodeTransforms {
    const rotation = {
      x: clampRotation(THREE.MathUtils.radToDeg(obj.rotation.x)),
      y: clampRotation(THREE.MathUtils.radToDeg(obj.rotation.y)),
      z: clampRotation(THREE.MathUtils.radToDeg(obj.rotation.z)),
    };
    obj.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
    );

    const scale =
      mode === "scale"
        ? clampScale(getActiveAxisUniformScale(obj))
        : clampScale(obj.scale.x);
    obj.scale.setScalar(scale);

    return {
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      },
      rotation,
      scale,
    };
  }

  function renderTransformSection(
    nodeId: string,
    mode: TransformMode,
    target: NeckTransformTarget = "neck",
    className?: string,
  ) {
    const isHeadstockTarget = target === "headstock";
    const draft = isHeadstockTarget
      ? (headstockTransformInputDraftByNodeId[nodeId] ??
        toTransformInputDraft(getHeadstockTransformsForNode(nodeId)))
      : (transformInputDraftByNodeId[nodeId] ??
        toTransformInputDraft(getNodeTransformsById(nodeId)));
    const visibleFields = TRANSFORM_FIELDS.filter((field) =>
      TRANSFORM_FIELDS_BY_MODE[mode].includes(field.key),
    );
    const isAxisMode = mode === "translate" || mode === "rotate";

    return (
      <section
        className={cn(
          "rounded border border-white/10 bg-black/10 p-2",
          className,
        )}
      >
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {mode === "translate"
            ? "Position"
            : mode === "rotate"
              ? "Rotation"
              : "Scale"}
        </div>
        <div
          className={cn("text-xs", isAxisMode ? "flex gap-2" : "grid gap-2")}
        >
          {visibleFields.map((field) => (
            <label
              key={field.key}
              className={cn(
                isAxisMode ? "min-w-0 flex-1" : "",
                field.key === "scale" ? "col-span-2" : "",
              )}
            >
              {isAxisMode
                ? field.key.endsWith("X")
                  ? "X"
                  : field.key.endsWith("Y")
                    ? "Y"
                    : "Z"
                : field.label}
              <input
                className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={draft[field.key]}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (isHeadstockTarget) {
                    setHeadstockTransformInputValue(nodeId, field.key, raw);
                  } else {
                    setTransformInputValue(nodeId, field.key, raw);
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed)) return;
                  const current = isHeadstockTarget
                    ? getHeadstockTransformsForNode(nodeId)
                    : getNodeTransformsById(nodeId);
                  const next = updateTransformsByInputKey(
                    current,
                    field.key,
                    parsed,
                  );
                  if (isHeadstockTarget) {
                    applyHeadstockTransformsToDraft(nodeId, next);
                  } else {
                    scheduleTransformSave(nodeId, next);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (isHeadstockTarget) {
                    commitHeadstockTransformInput(nodeId, field.key);
                  } else {
                    commitTransformInput(nodeId, field.key);
                  }
                }}
                onBlur={() => {
                  if (isHeadstockTarget) {
                    commitHeadstockTransformInput(nodeId, field.key);
                  } else {
                    commitTransformInput(nodeId, field.key);
                  }
                }}
              />
            </label>
          ))}
        </div>
      </section>
    );
  }

  const sortedNodesByParentId = useMemo(() => {
    const map = new Map<string | null, ProjectNode[]>();
    for (const node of nodes) {
      const key = node.parent_id ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.push(node);
      else map.set(key, [node]);
    }
    for (const [key, bucket] of map.entries()) {
      map.set(
        key,
        [...bucket].sort((a, b) => {
          if (a.sort_index !== b.sort_index) return a.sort_index - b.sort_index;
          return a.id.localeCompare(b.id);
        }),
      );
    }
    return map;
  }, [nodes]);

  const sceneRootNodes = useMemo(() => {
    const byId = new Set(nodes.map((node) => node.id));
    return nodes
      .filter((node) => !node.parent_id || !byId.has(node.parent_id))
      .sort((a, b) => {
        if (a.sort_index !== b.sort_index) return a.sort_index - b.sort_index;
        return a.id.localeCompare(b.id);
      });
  }, [nodes]);

  const renderSceneNode = useCallback(
    (node: ProjectNode) => {
      const transforms = normalizeNodeTransforms(node.transforms);
      const pos = transforms.position;
      const rot = transforms.rotation;
      const scale = transforms.scale;
      const isNeck = node.asset?.part_type === "neck";
      const isBody = node.asset?.part_type === "body";
      const neckParams = getNeckParamsForNode(node);
      const headstockRenderState = getHeadstockRenderState(neckParams);
      const headstockUrl = headstockRenderState.url;
      const headstockUnavailableError = headstockRenderState.unavailableError;
      const children = sortedNodesByParentId.get(node.id) ?? [];
      const hasRenderableSelf = isNeck ? !!neckParams : !!node.asset?.modelUrl;

      if (!hasRenderableSelf && children.length === 0) return null;

      return (
        <group
          key={node.id}
          ref={(g) => {
            nodeRefs.current[node.id] = g;
            if (node.id === selectedNodeId) {
              setSelectedObject(
                resolveSelectedObject(
                  node.id,
                  transformMode,
                  neckTransformTarget,
                ),
              );
            }
          }}
          position={[pos.x, pos.y, pos.z]}
          rotation={[
            THREE.MathUtils.degToRad(rot.x),
            THREE.MathUtils.degToRad(rot.y),
            THREE.MathUtils.degToRad(rot.z),
          ]}
          scale={[scale, scale, scale]}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (shouldIgnoreSceneSelection()) return;
            setSelectedNodeId(node.id);
            if (isNeck) {
              setNeckTransformTarget("neck");
            }
          }}
        >
          <Suspense fallback={null}>
            {isNeck && neckParams ? (
              <ProceduralNeckMesh
                params={neckParams}
                headstockUrl={headstockUrl}
                headstockUnavailableError={headstockUnavailableError}
                onHeadstockStateChange={(state) =>
                  setHeadstockLoadState(node.id, state)
                }
                onHeadstockTranslateGroupChange={(group) => {
                  headstockTranslateRefs.current[node.id] = group;
                  if (
                    node.id === selectedNodeId &&
                    neckTransformTarget === "headstock" &&
                    transformMode === "translate"
                  ) {
                    setSelectedObject(
                      resolveSelectedObject(
                        node.id,
                        transformMode,
                        neckTransformTarget,
                      ),
                    );
                  }
                }}
                onHeadstockRotateScaleGroupChange={(group) => {
                  headstockRotateScaleRefs.current[node.id] = group;
                  if (
                    node.id === selectedNodeId &&
                    neckTransformTarget === "headstock" &&
                    transformMode !== "translate"
                  ) {
                    setSelectedObject(
                      resolveSelectedObject(
                        node.id,
                        transformMode,
                        neckTransformTarget,
                      ),
                    );
                  }
                }}
                onHeadstockPointerDown={() => {
                  setSelectedNodeId(node.id);
                  setNeckTransformTarget("headstock");
                }}
              />
            ) : !isNeck && node.asset?.modelUrl ? (
              <ModelAssetView
                url={node.asset.modelUrl}
                nodeId={node.id}
                centerModel={!isBody}
                onLoaded={markNodeLoaded}
              />
            ) : null}
          </Suspense>
          {children.map((child) => renderSceneNode(child))}
        </group>
      );
    },
    [
      getHeadstockRenderState,
      getNeckParamsForNode,
      markNodeLoaded,
      neckTransformTarget,
      resolveSelectedObject,
      selectedNodeId,
      setHeadstockLoadState,
      sortedNodesByParentId,
      transformMode,
      shouldIgnoreSceneSelection,
    ],
  );

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 flex-col gap-3 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Project {projectId ?? "Playground"}
        </div>
        <div className="text-xs text-muted-foreground">{statusLabel}</div>
      </div>
      {toastMessage ? (
        <div className="rounded border border-amber-300/60 bg-amber-500/20 px-3 py-2 text-xs text-amber-100">
          {toastMessage}
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 gap-3",
          selectedNeckNode
            ? "grid grid-cols-[minmax(0,1fr)_380px]"
            : "flex flex-col",
        )}
      >
        <div className="relative h-[58vh] min-h-[360px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1111]">
          {selectedNode && selectedObject && !selectedNeckNode ? (
            <div className="absolute left-3 top-3 z-10 w-[280px]">
              {renderTransformSection(selectedNode.id, transformMode)}
            </div>
          ) : null}
          {selectedBodyOrNeckNode && assemblyWarnings.length > 0 ? (
            <div className="absolute left-3 bottom-3 z-10 w-[360px] rounded border border-amber-300/60 bg-black/70 px-3 py-2">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                Body-Neck Warnings
              </div>
              <div className="space-y-1 text-xs text-amber-100">
                {assemblyWarnings.map((warning) => (
                  <div key={warning.id}>{warning.message}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded border border-white/20 bg-black/40 p-1 text-xs">
            {TRANSFORM_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={!selectedObject || !!deletingNodeId}
                className={cn(
                  "rounded px-2 py-1 capitalize transition",
                  transformMode === mode
                    ? "bg-emerald-500/30 text-emerald-200"
                    : "text-muted-foreground hover:bg-white/10",
                  (!selectedObject || !!deletingNodeId) &&
                    "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
                onClick={() => setTransformMode(mode)}
              >
                {mode}
              </button>
            ))}
            <button
              type="button"
              disabled={!selectedNodeId || !!deletingNodeId}
              className={cn(
                "ml-1 rounded border border-rose-400/60 px-2 py-1 text-rose-200 transition hover:bg-rose-500/20",
                (!selectedNodeId || !!deletingNodeId) &&
                  "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
              onClick={() => void deleteSelectedModel()}
            >
              {deletingNodeId ? "Deleting..." : "Delete"}
            </button>
          </div>
          <Canvas
            //shadows
            camera={{ position: [4.8, 3.2, 5.2], fov: 45 }}
            onCreated={({ gl, camera }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.0;
              cameraRef.current = camera as THREE.PerspectiveCamera;
            }}
          >
            <color attach="background" args={["#0b1111"]} />
            <fog attach="fog" args={["#0b1111", 10, 35]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 8, 4]} intensity={1.3} castShadow />
            <pointLight position={[-4, -2, -6]} intensity={0.6} />
            <Grid
              args={[12, 12]}
              cellColor="#1e3a37"
              sectionColor="#2d5a55"
              fadeDistance={18}
              fadeStrength={1}
              position={[0, -0.5, 0]}
            />

            {sceneRootNodes.map((node) => renderSceneNode(node))}

            {selectedNodeId ? (
              <TransformControls
                ref={transformRef}
                key={
                  selectedNodeId
                    ? `${selectedNodeId}:${neckTransformTarget}`
                    : undefined
                }
                mode={transformMode}
                space="local"
                onMouseDown={() => {
                  transformPointerDownRef.current = true;
                  setOrbitEnabled(false);
                  recenterToSelectedNode(false);
                }}
                onMouseUp={() => {
                  setOrbitEnabled(true);
                  recenterToSelectedNode(true);
                  window.requestAnimationFrame(() => {
                    transformPointerDownRef.current = false;
                  });
                }}
                onObjectChange={() => {
                  const nodeId = selectedNodeId;
                  if (!nodeId) return;
                  const node = nodesRef.current.find((n) => n.id === nodeId);
                  if (!node) return;
                  const isHeadstockTarget =
                    node.asset?.part_type === "neck" &&
                    neckTransformTarget === "headstock";
                  if (isHeadstockTarget) {
                    const nextHeadstockTransforms =
                      snapshotHeadstockTransformsFromObjects(
                        nodeId,
                        transformMode,
                      );
                    applyHeadstockTransformsToDraft(
                      nodeId,
                      nextHeadstockTransforms,
                    );
                    return;
                  }
                  const obj = nodeRefs.current[nodeId];
                  if (!obj) return;
                  const nextTransforms = snapshotNodeTransformsFromObject(
                    obj,
                    transformMode,
                  );
                  scheduleTransformSave(nodeId, nextTransforms);
                }}
              />
            ) : null}
            <TransformControlsSync
              controlsRef={transformRef}
              object={selectedObject}
            />

            {isModelLoading &&
            !hideModelLoadBadge &&
            !modelLoadBadgeTimedOut ? (
              <Html fullscreen className="pointer-events-none">
                <div className="absolute bottom-3 right-3 z-10 pointer-events-auto">
                  <div className="flex items-center gap-2 rounded-md border border-emerald-400/40 bg-black/60 px-2 py-1 text-[11px] text-emerald-100 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                    <span>
                      Loading models {loadProgress.pct}% ({loadProgress.loaded}/
                      {loadProgress.total})
                    </span>
                    <button
                      type="button"
                      className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-white/10"
                      onClick={() => setHideModelLoadBadge(true)}
                    >
                      Hide
                    </button>
                  </div>
                </div>
              </Html>
            ) : null}
            <OrbitControls
              ref={orbitRef}
              makeDefault
              enabled={orbitEnabled}
              enableDamping
              dampingFactor={0.08}
            />
          </Canvas>
        </div>

        {selectedNeckNode ? (
          <aside className="h-[58vh] min-h-[360px] overflow-auto rounded-lg border border-white/10 bg-[#121a1a] p-3">
            <div className="mb-3 text-sm font-medium">Neck Parameters</div>

            <div className="space-y-3 text-xs">
              {(() => {
                const nodeId = selectedNeckNode.id;
                const currentParams =
                  neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
                const isCompound =
                  currentParams.fingerboardRadiusMode === "compound";
                const currentHeadstockRenderState =
                  getHeadstockRenderState(currentParams);
                const canTargetHeadstock =
                  !!currentParams.headstockAssetId &&
                  !!currentHeadstockRenderState.url &&
                  !currentHeadstockRenderState.unavailableError;
                const currentHeadstockLoad = headstockLoadByNodeId[nodeId] ?? {
                  status: "idle",
                  message: null,
                };

                const renderNumberInput = (key: NumericNeckKey) => {
                  const meta = NUMERIC_NECK_META[key];
                  const value =
                    neckInputDraftByNodeId[nodeId]?.[key] ??
                    String(currentParams[key] as number);

                  return (
                    <label key={key}>
                      {meta.label}
                      <input
                        className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                        type="number"
                        min={meta.min}
                        max={meta.max}
                        step={meta.step}
                        value={value}
                        onChange={(e) =>
                          setNeckNumberInput(nodeId, key, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitNeckNumberInput(nodeId, key);
                          }
                        }}
                        onBlur={() => commitNeckNumberInput(nodeId, key)}
                      />
                    </label>
                  );
                };

                return (
                  <>
                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Transform Target
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={cn(
                            "rounded border px-2 py-1 text-[11px] transition",
                            neckTransformTarget === "neck"
                              ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                              : "border-white/20 text-muted-foreground hover:bg-white/10",
                          )}
                          onClick={() => setNeckTransformTarget("neck")}
                        >
                          Neck
                        </button>
                        <button
                          type="button"
                          disabled={!canTargetHeadstock}
                          className={cn(
                            "rounded border px-2 py-1 text-[11px] transition",
                            neckTransformTarget === "headstock"
                              ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                              : "border-white/20 text-muted-foreground hover:bg-white/10",
                            !canTargetHeadstock &&
                              "cursor-not-allowed opacity-50 hover:bg-transparent",
                          )}
                          onClick={() => setNeckTransformTarget("headstock")}
                        >
                          Headstock
                        </button>
                      </div>
                    </section>

                    {renderTransformSection(
                      nodeId,
                      transformMode,
                      neckTransformTarget,
                    )}
                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        General
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="col-span-2">
                          Headstock Asset
                          <select
                            className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                            value={
                              neckDraftByNodeId[selectedNeckNode.id]
                                ?.headstockAssetId ?? ""
                            }
                            onChange={(e) => {
                              const nextHeadstockAssetId =
                                e.target.value || null;
                              updateNeckDraft(selectedNeckNode.id, {
                                headstockAssetId: nextHeadstockAssetId,
                              });
                              setHeadstockTransformInputDraftByNodeId(
                                (prev) => {
                                  const nextParams = normalizeNeckParams({
                                    ...currentParams,
                                    headstockAssetId: nextHeadstockAssetId,
                                  });
                                  return {
                                    ...prev,
                                    [selectedNeckNode.id]:
                                      toTransformInputDraft(
                                        neckParamsToHeadstockTransforms(
                                          nextParams,
                                        ),
                                      ),
                                  };
                                },
                              );
                              if (nextHeadstockAssetId) {
                                setNeckTransformTarget("headstock");
                              } else {
                                setNeckTransformTarget("neck");
                              }
                            }}
                          >
                            <option value="">Select headstock</option>
                            {headstockAssets.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          {currentParams.headstockAssetId ? (
                            <div
                              className={cn(
                                "mt-1 text-[11px]",
                                currentHeadstockLoad.status === "error"
                                  ? "text-rose-300"
                                  : "text-muted-foreground",
                              )}
                            >
                              {currentHeadstockLoad.status === "loading"
                                ? "Headstock model loading..."
                                : currentHeadstockLoad.status === "ready"
                                  ? "Headstock model ready."
                                  : currentHeadstockLoad.status === "error"
                                    ? (currentHeadstockLoad.message ??
                                      "Headstock model failed to load.")
                                    : "Waiting for headstock model."}
                            </div>
                          ) : null}
                        </label>
                        {GENERAL_DIMENSION_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Profile
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          Profile Type
                          <select
                            className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                            value={
                              neckDraftByNodeId[selectedNeckNode.id]
                                ?.profileType ?? "C"
                            }
                            onChange={(e) =>
                              updateNeckDraft(selectedNeckNode.id, {
                                profileType: e.target
                                  .value as NeckParams["profileType"],
                              })
                            }
                          >
                            <option value="C">C</option>
                            <option value="U">U</option>
                            <option value="V">V</option>
                            <option value="D">D</option>
                          </select>
                        </label>
                        {PROFILE_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Fretboard
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="col-span-2">
                          Radius Mode
                          <select
                            className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                            value={currentParams.fingerboardRadiusMode}
                            onChange={(e) => {
                              const mode = e.target
                                .value as NeckParams["fingerboardRadiusMode"];
                              const next = normalizeNeckParams({
                                ...currentParams,
                                fingerboardRadiusMode: mode,
                              });
                              setNeckDraftByNodeId((prev) => ({
                                ...prev,
                                [selectedNeckNode.id]: next,
                              }));
                              setNeckInputDraftByNodeId((prev) => ({
                                ...prev,
                                [selectedNeckNode.id]:
                                  toNumericInputDraft(next),
                              }));
                            }}
                          >
                            <option value="single">single</option>
                            <option value="compound">compound</option>
                          </select>
                        </label>

                        {renderNumberInput("fingerboardRadiusStartIn")}
                        {isCompound ? (
                          renderNumberInput("fingerboardRadiusEndIn")
                        ) : (
                          <div className="self-end pb-1 text-[11px] text-muted-foreground">
                            End radius is locked to start radius in single mode.
                          </div>
                        )}
                        {FRETBOARD_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Nut
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {NUT_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Frets
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {FRETS_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Heel
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="col-span-2">
                          Heel Type
                          <select
                            className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                            value={currentParams.heelType}
                            onChange={(e) => {
                              const heelType = e.target
                                .value as NeckParams["heelType"];
                              updateNeckDraft(selectedNeckNode.id, {
                                heelType,
                              });
                            }}
                          >
                            <option value="flat">flat</option>
                            <option value="sculpted">sculpted</option>
                          </select>
                        </label>
                        {HEEL_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>

                    <section className="rounded border border-white/10 bg-black/10 p-2">
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Alignment
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ALIGNMENT_NUMERIC_NECK_KEYS.map((key) =>
                          renderNumberInput(key),
                        )}
                      </div>
                    </section>
                  </>
                );
              })()}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="rounded border border-emerald-400 px-3 py-1 text-xs"
                disabled={
                  savingNeckNodeId === selectedNeckNode.id ||
                  !neckDraftByNodeId[selectedNeckNode.id]?.headstockAssetId ||
                  headstockLoadByNodeId[selectedNeckNode.id]?.status !== "ready"
                }
                onClick={() => void applyAndSaveNeck(selectedNeckNode)}
              >
                {savingNeckNodeId === selectedNeckNode.id
                  ? "Saving..."
                  : "Apply & Save"}
              </button>
              <button
                className="rounded border border-white/30 px-3 py-1 text-xs"
                onClick={() => resetNeckDraft(selectedNeckNode.id)}
              >
                Reset
              </button>
            </div>
          </aside>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-[#0f1616] p-3">
        <div className="mb-2 text-sm text-muted-foreground">
          <div className="mb-3 flex flex-row gap-3">
            <div className="flex items-center">My Assets</div>
            <PartFilters
              activePart={activePart}
              sort={assetSort}
              onPartChange={setActivePart}
              onSortChange={setAssetSort}
            />
          </div>
        </div>
        {libraryAssets.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No assets available in your library.
          </div>
        ) : activePart === "neck" ? (
          <div className="overflow-x-auto overflow-y-hidden pb-2">
            <div className="grid grid-flow-col auto-cols-[160px] gap-3">
              <button
                type="button"
                className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 text-left transition hover:bg-emerald-500/20"
                onClick={() => void createParameterizedNeck()}
                disabled={creatingNeck}
              >
                <div className="relative mb-2 h-20 w-full overflow-hidden rounded bg-black/30">
                  <div className="flex h-full items-center justify-center text-2xl text-emerald-300">
                    +
                  </div>
                </div>
                <div className="truncate text-xs font-medium">
                  New Parameterized Neck
                </div>
                <div className="mt-2 text-[11px] text-emerald-300">
                  {creatingNeck ? "Creating..." : "Create + Add"}
                </div>
              </button>

              {visibleLibraryAssets.length === 0 ? (
                <div className="flex h-full items-center text-sm text-muted-foreground">
                  No assets match your current filters.
                </div>
              ) : (
                visibleLibraryAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="rounded-md border border-white/10 bg-black/20 p-2 text-left transition hover:bg-(--primary)"
                    onClick={() => addAssetToProject(asset.id)}
                    disabled={addingAssetId === asset.id}
                  >
                    <div className="relative mb-2 h-20 w-full overflow-hidden rounded bg-black/30">
                      {asset.previewUrl ? (
                        <Image
                          src={asset.previewUrl}
                          alt={`${asset.name} preview`}
                          fill={true}
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                          className="object-cover"
                          onError={() => {
                            void loadProjectData();
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No preview
                        </div>
                      )}
                    </div>
                    <div className="truncate text-xs font-medium">
                      {asset.name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {asset.part_type?.replace(/_/g, " ") ?? "untyped"}
                    </div>
                    <div className="mt-2 text-[11px] text-emerald-300">
                      {addingAssetId === asset.id
                        ? "Adding..."
                        : "Add to project"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : visibleLibraryAssets.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No assets match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-hidden pb-2">
            <div className="grid grid-flow-col auto-cols-[160px] gap-3">
              {visibleLibraryAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="rounded-md border border-white/10 bg-black/20 p-2 text-left transition hover:bg-(--primary)"
                  onClick={() => addAssetToProject(asset.id)}
                  disabled={addingAssetId === asset.id}
                >
                  <div className="relative mb-2 h-20 w-full overflow-hidden rounded bg-black/30">
                    {asset.previewUrl ? (
                      <Image
                        src={asset.previewUrl}
                        alt={`${asset.name} preview`}
                        fill={true}
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
                        className="object-cover"
                        onError={() => {
                          void loadProjectData();
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="truncate text-xs font-medium">
                    {asset.name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {asset.part_type?.replace(/_/g, " ") ?? "untyped"}
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-300">
                    {addingAssetId === asset.id
                      ? "Adding..."
                      : "Add to project"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
