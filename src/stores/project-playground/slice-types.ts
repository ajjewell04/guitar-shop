import type { NeckParams } from "@/lib/neck-params";
import type { HeadstockLoadState } from "@/components/procedural-neck-mesh";
import type {
  PartType,
  SortKey,
  TransformMode,
  NeckTransformTarget,
  AssemblyWarning,
  LibraryAsset,
  ProjectNode,
  NodeTransforms,
  TransformInputDraft,
  TransformInputKey,
  NumericNeckKey,
  NodePatch,
} from "./types";

// ─── UI ──────────────────────────────────────────────────────────────────────

export type UISlice = {
  selectedNodeId: string | null;
  transformMode: TransformMode;
  neckTransformTarget: NeckTransformTarget;
  orbitEnabled: boolean;
  loadedNodeIds: Set<string>;
  hideModelLoadBadge: boolean;
  modelLoadBadgeTimedOut: boolean;
  activePart: PartType;
  assetSort: SortKey;
  assemblyWarnings: AssemblyWarning[];
  toastMessage: string | null;
  assetSearch: string;

  setSelectedNodeId: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setNeckTransformTarget: (target: NeckTransformTarget) => void;
  setOrbitEnabled: (enabled: boolean) => void;
  markNodeLoaded: (nodeId: string) => void;
  resetLoadedNodes: () => void;
  setHideModelLoadBadge: (hide: boolean) => void;
  setModelLoadBadgeTimedOut: (timedOut: boolean) => void;
  setActivePart: (part: PartType) => void;
  setAssetSort: (sort: SortKey) => void;
  setAssemblyWarnings: (warnings: AssemblyWarning[]) => void;
  showToast: (message: string) => void;
};

// ─── Nodes ───────────────────────────────────────────────────────────────────

export type NodesSlice = {
  projectId: string | undefined;
  nodes: ProjectNode[];
  projectRootNodeId: string | null;
  libraryAssets: LibraryAsset[];
  status: "idle" | "loading" | "error";
  errorMessage: string | null;
  addingAssetId: string | null;
  deletingNodeId: string | null;

  loadProjectData: (preferredNodeId?: string) => Promise<ProjectNode[]>;
  addAssetToProject: (
    assetId: string,
    partTypeHint?: string | null,
  ) => Promise<string | null>;
  deleteSelectedNode: () => Promise<void>;
  patchProjectNode: (nodeId: string, patch: NodePatch) => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
  flushProjectPreview: () => void;
  clearNodeDraft: (nodeId: string) => void;
};

// ─── Transforms ──────────────────────────────────────────────────────────────

export type TransformsSlice = {
  transformInputDraftByNodeId: Record<string, TransformInputDraft>;
  headstockTransformInputDraftByNodeId: Record<string, TransformInputDraft>;

  getNodeTransformsById: (nodeId: string) => NodeTransforms;
  setTransformInputValue: (
    nodeId: string,
    key: TransformInputKey,
    raw: string,
  ) => void;
  commitTransformInput: (nodeId: string, key: TransformInputKey) => void;
  setHeadstockTransformInputValue: (
    nodeId: string,
    key: TransformInputKey,
    raw: string,
  ) => void;
  commitHeadstockTransformInput: (
    nodeId: string,
    key: TransformInputKey,
  ) => void;
  applyLocalNodeTransforms: (
    nodeId: string,
    transforms: NodeTransforms,
  ) => void;
  scheduleTransformSave: (nodeId: string, transforms: NodeTransforms) => void;
  flushPendingNodeSaves: () => Promise<void>;
  clearTransformDraft: (nodeId: string) => void;
};

// ─── Neck ────────────────────────────────────────────────────────────────────

export type NeckSlice = {
  neckDraftByNodeId: Record<string, NeckParams>;
  neckInputDraftByNodeId: Record<
    string,
    Partial<Record<NumericNeckKey, string>>
  >;
  headstockLoadByNodeId: Record<string, HeadstockLoadState>;
  savingNeckNodeId: string | null;
  creatingNeck: boolean;

  getNeckParamsForNode: (node: ProjectNode) => NeckParams | null;
  getHeadstockTransformsForNode: (nodeId: string) => NodeTransforms;
  initNeckDraft: (node: ProjectNode) => void;
  updateNeckDraft: (nodeId: string, patch: Partial<NeckParams>) => void;
  resetNeckDraft: (nodeId: string) => void;
  setNeckNumberInput: (
    nodeId: string,
    key: NumericNeckKey,
    raw: string,
  ) => void;
  commitNeckNumberInput: (nodeId: string, key: NumericNeckKey) => void;
  setHeadstockLoadState: (nodeId: string, state: HeadstockLoadState) => void;
  applyHeadstockTransformsToDraft: (
    nodeId: string,
    transforms: NodeTransforms,
  ) => void;
  createParameterizedNeck: () => Promise<void>;
  applyAndSaveNeck: (
    node: ProjectNode,
    group: import("three").Group,
  ) => Promise<void>;
  clearNeckDraft: (nodeId: string) => void;
};

// ─── Combined ────────────────────────────────────────────────────────────────

export type FullStore = UISlice & NodesSlice & TransformsSlice & NeckSlice;
