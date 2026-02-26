"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  Suspense,
  useCallback,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  Grid,
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
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
import ProceduralNeckMesh from "@/components/procedural-neck-mesh";

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

type ProjectNode = {
  id: string;
  name: string;
  type: "assembly" | "part";
  parent_id: string | null;
  sort_index: number;
  asset_id: string | null;
  transforms?: {
    position?: { x: number; y: number; z: number };
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

type NumericNeckKey =
  | "scaleLengthIn"
  | "fretCount"
  | "nutWidthMm"
  | "widthAtLastFretMm"
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
  | "neckAngleDeg";

type NumericNeckMeta = {
  label: string;
  min: number;
  max: number;
  step: number;
  integer?: true;
};

const NUMERIC_NECK_META: Record<NumericNeckKey, NumericNeckMeta> = {
  scaleLengthIn: { label: "Scale Length (in)", min: 22.5, max: 27, step: 0.01 },
  fretCount: { label: "Fret Count", min: 20, max: 24, step: 1, integer: true },
  nutWidthMm: { label: "Nut Width (mm)", min: 38, max: 48, step: 0.1 },
  widthAtLastFretMm: {
    label: "Last Fret Width (mm)",
    min: 50,
    max: 62,
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
  heelLengthMm: { label: "Heel Length (mm)", min: 70, max: 90, step: 0.1 },
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
};

const NUMERIC_NECK_KEYS = Object.keys(NUMERIC_NECK_META) as NumericNeckKey[];
const GENERAL_NUMERIC_NECK_KEYS = NUMERIC_NECK_KEYS.filter(
  (k) => k !== "fingerboardRadiusStartIn" && k !== "fingerboardRadiusEndIn",
);

function toNumericInputDraft(
  params: NeckParams,
): Record<NumericNeckKey, string> {
  return Object.fromEntries(
    NUMERIC_NECK_KEYS.map((k) => [k, String(params[k] as number)]),
  ) as Record<NumericNeckKey, string>;
}

function ModelAssetView({
  url,
  nodeId,
  onLoaded,
}: {
  url: string;
  nodeId: string;
  onLoaded: (nodeId: string) => void;
}) {
  const gltf = useGLTF(url) as unknown as GLTF;

  useEffect(() => {
    onLoaded(nodeId);
  }, [nodeId, onLoaded]);

  const centeredScene = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.sub(center);
    return scene;
  }, [gltf.scene]);

  return <primitive object={centeredScene} />;
}

export default function ProjectPlayground({
  projectId,
  className,
}: ProjectPlaygroundProps) {
  const [nodes, setNodes] = useState<ProjectNode[]>([]);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [addingAssetId, setAddingAssetId] = useState<string | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [selectedObject, setSelectedObject] = useState<THREE.Group | null>(
    null,
  );
  const [loadedNodeIds, setLoadedNodeIds] = useState<Set<string>>(new Set());
  const [assetSearch, setAssetSearch] = useState("");
  const [activePart, setActivePart] = useState<PartType>("all");
  const [assetSort, setAssetSort] = useState<SortKey>("asc");
  const [neckDraftByNodeId, setNeckDraftByNodeId] = useState<
    Record<string, NeckParams>
  >({});
  const [savingNeckNodeId, setSavingNeckNodeId] = useState<string | null>(null);
  const [creatingNeck, setCreatingNeck] = useState(false);
  const [neckInputDraftByNodeId, setNeckInputDraftByNodeId] = useState<
    Record<string, Partial<Record<NumericNeckKey, string>>>
  >({});

  const nodeRefs = useRef<Record<string, THREE.Group | null>>({});
  const saveTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const recenterRafRef = useRef<number | null>(null);

  const projectIdRef = useRef<string | undefined>(projectId);
  const nodesRef = useRef<ProjectNode[]>([]);
  const previewFlushInFlightRef = useRef<Promise<void> | null>(null);

  const expectedModelNodes = useMemo(
    () => nodes.filter((n) => !!n.asset?.modelUrl).map((n) => n.id),
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

  useEffect(() => {
    setLoadedNodeIds(new Set());
  }, [expectedModelNodes.join("|")]);

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
    nodesRef.current = nodes;
  }, [nodes]);

  const flushProjectPreview = useCallback(() => {
    if (previewFlushInFlightRef.current) return;

    const currentProjectId = projectIdRef.current;
    if (!currentProjectId) return;

    const previewNodes = toPreviewNodes(nodesRef.current);
    if (!previewNodes.length) return;

    previewFlushInFlightRef.current = (async () => {
      await flushPendingNodeSaves();
      const previewNodes = toPreviewNodes(nodesRef.current);
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
    return () => {
      flushProjectPreview();
    };
  }, [flushProjectPreview]);

  const getObjectWorldCenter = useCallback((obj: THREE.Object3D) => {
    obj.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
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
      setLibraryAssets([]);
      setSelectedNodeId(null);
      setStatus("idle");
      return [];
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/project-nodes?projectId=${projectId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ProjectNodesResponse;
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load project nodes");
      }

      const nextNodes = data.nodes ?? [];
      setNodes(nextNodes);
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
    };
  }, [projectId]);

  async function addAssetToProject(assetId: string): Promise<string | null> {
    if (!projectId) return null;

    setAddingAssetId(assetId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/project-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to add asset to project");
      }

      const createdNodeId =
        typeof data?.node?.id === "string" ? data.node.id : null;

      const nextNodes = await loadProjectData(createdNodeId ?? undefined);

      if (!createdNodeId) {
        const byAsset =
          nextNodes.find((n) => n.asset_id === assetId)?.id ?? null;
        if (byAsset) setSelectedNodeId(byAsset);
        return byAsset;
      }

      return createdNodeId;
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

  const pendingNodePositionsRef = useRef<
    Map<string, { x: number; y: number; z: number }>
  >(new Map());

  function applyLocalNodePosition(
    nodeId: string,
    pos: { x: number; y: number; z: number },
  ) {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === nodeId
          ? { ...n, transforms: { ...(n.transforms ?? {}), position: pos } }
          : n,
      );
      nodesRef.current = next;
      return next;
    });
  }

  async function persistNodePosition(
    nodeId: string,
    pos: { x: number; y: number; z: number },
  ) {
    const res = await fetch("/api/project-nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, position: pos }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? "Save failed.");
    }
  }

  function scheduleSave(
    nodeId: string | null,
    pos: { x: number; y: number; z: number } | null,
  ) {
    if (!nodeId || !pos) return;

    applyLocalNodePosition(nodeId, pos);
    pendingNodePositionsRef.current.set(nodeId, pos);

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(async () => {
      const pending = Array.from(pendingNodePositionsRef.current.entries());
      pendingNodePositionsRef.current.clear();
      try {
        await Promise.all(pending.map(([id, p]) => persistNodePosition(id, p)));
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
    const pending = Array.from(pendingNodePositionsRef.current.entries());
    if (!pending.length) return;
    pendingNodePositionsRef.current.clear();
    await Promise.all(pending.map(([id, p]) => persistNodePosition(id, p)));
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
  }, [status, errorMessage, nodes.length]);

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

  const selectedNeckNode = useMemo(() => {
    if (!selectedNode?.asset) return null;
    if (selectedNode.asset.part_type !== "neck") return null;
    return selectedNode;
  }, [selectedNode]);

  const headstockAssets = useMemo(
    () => libraryAssets.filter((a) => a.part_type === "headstock"),
    [libraryAssets],
  );

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

  async function createParameterizedNeck() {
    if (!projectId || creatingNeck) return;

    setCreatingNeck(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/models/neck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Parametric Neck" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.assetId) {
        throw new Error(payload?.error ?? "Failed to create neck");
      }

      const createdNodeId = await addAssetToProject(payload.assetId);

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

    const group = nodeRefs.current[node.id];
    if (!group) throw new Error("Neck object not ready");

    setSavingNeckNodeId(node.id);
    setErrorMessage(null);

    try {
      const glbFile = await exportGroupToGlb(group);
      const previewBlob = await renderModelPreview(glbFile);

      const presignRes = await fetch("/api/models/neck/presign", {
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

      const saveRes = await fetch("/api/models/neck/save", {
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

      <div
        className={cn(
          "min-h-0 flex-1 gap-3",
          selectedNeckNode
            ? "grid grid-cols-[minmax(0,1fr)_380px]"
            : "flex flex-col",
        )}
      >
        <div className="relative h-[58vh] min-h-[360px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1111]">
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

            {nodes.map((node) => {
              const pos = node.transforms?.position ?? { x: 0, y: 0, z: 0 };
              const isNeck = node.asset?.part_type === "neck";
              const neckParams = getNeckParamsForNode(node);

              if (!isNeck && !node.asset?.modelUrl) return null;
              if (isNeck && !neckParams) return null;

              return (
                <group
                  key={node.id}
                  ref={(g) => {
                    nodeRefs.current[node.id] = g;
                    if (node.id === selectedNodeId) {
                      setSelectedObject(g);
                    }
                  }}
                  position={[pos.x, pos.y, pos.z]}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                >
                  <Suspense fallback={null}>
                    {isNeck && neckParams ? (
                      <ProceduralNeckMesh params={neckParams} />
                    ) : !isNeck ? (
                      <ModelAssetView
                        url={node.asset!.modelUrl!}
                        nodeId={node.id}
                        onLoaded={markNodeLoaded}
                      />
                    ) : null}
                  </Suspense>
                </group>
              );
            })}

            {selectedObject ? (
              <TransformControls
                key={selectedNodeId ?? undefined}
                object={selectedObject}
                mode="translate"
                onMouseDown={() => {
                  setOrbitEnabled(false);
                  recenterToSelectedNode(false);
                }}
                onMouseUp={() => {
                  setOrbitEnabled(true);
                  recenterToSelectedNode(true);
                }}
                onObjectChange={() => {
                  const nodeId = selectedNodeId;
                  if (!nodeId) return;
                  const obj = nodeRefs.current[nodeId];
                  if (!obj) return;
                  scheduleSave(nodeId, {
                    x: obj.position.x,
                    y: obj.position.y,
                    z: obj.position.z,
                  });
                }}
              />
            ) : null}

            {loadProgress.total > 0 &&
            loadProgress.loaded < loadProgress.total ? (
              <Html
                fullscreen
                className="pointer-events-none grid place-items-center"
              >
                <div className="rounded-md bg-black/60 px-3 py-2 text-xs">
                  Loading {loadProgress.pct}% ({loadProgress.loaded}/
                  {loadProgress.total})
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

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="col-span-2">
                Headstock Asset
                <select
                  className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                  value={
                    neckDraftByNodeId[selectedNeckNode.id]?.headstockAssetId ??
                    ""
                  }
                  onChange={(e) =>
                    updateNeckDraft(selectedNeckNode.id, {
                      headstockAssetId: e.target.value || null,
                    })
                  }
                >
                  <option value="">Select headstock</option>
                  {headstockAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Profile Type
                <select
                  className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                  value={
                    neckDraftByNodeId[selectedNeckNode.id]?.profileType ?? "C"
                  }
                  onChange={(e) =>
                    updateNeckDraft(selectedNeckNode.id, {
                      profileType: e.target.value as NeckParams["profileType"],
                    })
                  }
                >
                  <option value="C">C</option>
                  <option value="U">U</option>
                  <option value="V">V</option>
                  <option value="D">D</option>
                </select>
              </label>

              <label>
                Fingerboard Radius Mode
                <select
                  className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                  value={
                    neckDraftByNodeId[selectedNeckNode.id]
                      ?.fingerboardRadiusMode ?? "single"
                  }
                  onChange={(e) => {
                    const mode = e.target
                      .value as NeckParams["fingerboardRadiusMode"];
                    const current =
                      neckDraftByNodeId[selectedNeckNode.id] ??
                      DEFAULT_NECK_PARAMS;
                    const next = normalizeNeckParams({
                      ...current,
                      fingerboardRadiusMode: mode,
                    });
                    setNeckDraftByNodeId((prev) => ({
                      ...prev,
                      [selectedNeckNode.id]: next,
                    }));
                    setNeckInputDraftByNodeId((prev) => ({
                      ...prev,
                      [selectedNeckNode.id]: toNumericInputDraft(next),
                    }));
                  }}
                >
                  <option value="single">single</option>
                  <option value="compound">compound</option>
                </select>
              </label>

              {(() => {
                const nodeId = selectedNeckNode.id;
                const currentParams =
                  neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
                const isCompound =
                  currentParams.fingerboardRadiusMode === "compound";

                return (
                  <>
                    <label>
                      {NUMERIC_NECK_META.fingerboardRadiusStartIn.label}
                      <input
                        className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                        type="number"
                        min={NUMERIC_NECK_META.fingerboardRadiusStartIn.min}
                        max={NUMERIC_NECK_META.fingerboardRadiusStartIn.max}
                        step={NUMERIC_NECK_META.fingerboardRadiusStartIn.step}
                        value={
                          neckInputDraftByNodeId[nodeId]
                            ?.fingerboardRadiusStartIn ??
                          String(currentParams.fingerboardRadiusStartIn)
                        }
                        onChange={(e) =>
                          setNeckNumberInput(
                            nodeId,
                            "fingerboardRadiusStartIn",
                            e.target.value,
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitNeckNumberInput(
                              nodeId,
                              "fingerboardRadiusStartIn",
                            );
                          }
                        }}
                        onBlur={() =>
                          commitNeckNumberInput(
                            nodeId,
                            "fingerboardRadiusStartIn",
                          )
                        }
                      />
                    </label>

                    {isCompound ? (
                      <label>
                        {NUMERIC_NECK_META.fingerboardRadiusEndIn.label}
                        <input
                          className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                          type="number"
                          min={NUMERIC_NECK_META.fingerboardRadiusEndIn.min}
                          max={NUMERIC_NECK_META.fingerboardRadiusEndIn.max}
                          step={NUMERIC_NECK_META.fingerboardRadiusEndIn.step}
                          value={
                            neckInputDraftByNodeId[nodeId]
                              ?.fingerboardRadiusEndIn ??
                            String(currentParams.fingerboardRadiusEndIn)
                          }
                          onChange={(e) =>
                            setNeckNumberInput(
                              nodeId,
                              "fingerboardRadiusEndIn",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitNeckNumberInput(
                                nodeId,
                                "fingerboardRadiusEndIn",
                              );
                            }
                          }}
                          onBlur={() =>
                            commitNeckNumberInput(
                              nodeId,
                              "fingerboardRadiusEndIn",
                            )
                          }
                        />
                      </label>
                    ) : (
                      <div className="text-[11px] text-muted-foreground self-end pb-1">
                        End radius is locked to start radius in single mode.
                      </div>
                    )}

                    {GENERAL_NUMERIC_NECK_KEYS.map((key) => {
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
                    })}
                  </>
                );
              })()}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="rounded border border-emerald-400 px-3 py-1 text-xs"
                disabled={
                  savingNeckNodeId === selectedNeckNode.id ||
                  !neckDraftByNodeId[selectedNeckNode.id]?.headstockAssetId
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
