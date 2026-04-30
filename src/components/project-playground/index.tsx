"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import {
  createProjectPlaygroundStore,
  ProjectPlaygroundStoreContext,
  useProjectPlaygroundStore,
  type ProjectPlaygroundStoreApi,
} from "@/stores/project-playground/store";
import { toTransformInputDraft } from "@/stores/project-playground/utils";
import { SceneViewport } from "./scene-viewport";
import { NeckParamsPanel } from "./neck-params-panel";
import { AssetLibraryPanel } from "./asset-library-panel";

// ─── Provider ─────────────────────────────────────────────────────────────────

type ProjectPlaygroundProps = {
  projectId?: string;
  className?: string;
};

export default function ProjectPlayground({
  projectId,
  className,
}: ProjectPlaygroundProps) {
  const storeRef = useRef<{
    id: string | undefined;
    store: ProjectPlaygroundStoreApi;
  } | null>(null);
  if (!storeRef.current || storeRef.current.id !== projectId) {
    storeRef.current = {
      id: projectId,
      store: createProjectPlaygroundStore(projectId),
    };
  }

  return (
    <ProjectPlaygroundStoreContext.Provider value={storeRef.current.store}>
      <ProjectPlaygroundCoordinator className={className} />
    </ProjectPlaygroundStoreContext.Provider>
  );
}

// ─── Coordinator ──────────────────────────────────────────────────────────────

function ProjectPlaygroundCoordinator({ className }: { className?: string }) {
  // Shared Three.js refs — SceneViewport writes them, NeckParamsPanel reads them
  const nodeRefs = useRef<Record<string, THREE.Group | null>>({});
  const headstockTranslateRefs = useRef<Record<string, THREE.Group | null>>({});
  const headstockRotateScaleRefs = useRef<Record<string, THREE.Group | null>>(
    {},
  );

  const getGroupForNode = useCallback((nodeId: string): THREE.Group | null => {
    return nodeRefs.current[nodeId] ?? null;
  }, []);

  // Store state
  const projectId = useProjectPlaygroundStore((s) => s.projectId);
  const nodes = useProjectPlaygroundStore((s) => s.nodes);
  const status = useProjectPlaygroundStore((s) => s.status);
  const errorMessage = useProjectPlaygroundStore((s) => s.errorMessage);
  const toastMessage = useProjectPlaygroundStore((s) => s.toastMessage);
  const selectedNodeId = useProjectPlaygroundStore((s) => s.selectedNodeId);
  const transformInputDraftByNodeId = useProjectPlaygroundStore(
    (s) => s.transformInputDraftByNodeId,
  );

  // Store actions
  const loadProjectData = useProjectPlaygroundStore((s) => s.loadProjectData);
  const flushProjectPreview = useProjectPlaygroundStore(
    (s) => s.flushProjectPreview,
  );
  const setTransformInputValue = useProjectPlaygroundStore(
    (s) => s.setTransformInputValue,
  );
  const initNeckDraft = useProjectPlaygroundStore((s) => s.initNeckDraft);
  const setNeckTransformTarget = useProjectPlaygroundStore(
    (s) => s.setNeckTransformTarget,
  );
  const neckTransformTarget = useProjectPlaygroundStore(
    (s) => s.neckTransformTarget,
  );

  // Derived
  const loadedModelCount = useMemo(
    () => nodes.filter((n) => !!n.asset?.modelUrl).length,
    [nodes],
  );
  const statusLabel = useMemo(() => {
    if (status === "loading") return "Loading project...";
    if (status === "error")
      return errorMessage ?? "Unable to load project data.";
    if (loadedModelCount === 0) return "No models in project yet.";
    return `${loadedModelCount} model${loadedModelCount === 1 ? "" : "s"} in project`;
  }, [status, errorMessage, loadedModelCount]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedNeckNode = useMemo(
    () => (selectedNode?.asset?.part_type === "neck" ? selectedNode : null),
    [selectedNode],
  );

  const libraryAssets = useProjectPlaygroundStore((s) => s.libraryAssets);
  const getNeckParamsForNode = useProjectPlaygroundStore(
    (s) => s.getNeckParamsForNode,
  );

  const selectedNeckParams = useMemo(
    () => (selectedNeckNode ? getNeckParamsForNode(selectedNeckNode) : null),

    [selectedNeckNode, getNeckParamsForNode],
  );

  const canTargetSelectedHeadstock = useMemo(() => {
    if (!selectedNeckParams?.headstockAssetId) return false;
    const asset = libraryAssets.find(
      (a) => a.id === selectedNeckParams.headstockAssetId,
    );
    return !!asset?.modelUrl;
  }, [selectedNeckParams, libraryAssets]);

  // Orchestration effects

  useEffect(() => {
    void loadProjectData();
  }, [projectId, loadProjectData]);

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
  }, [
    canTargetSelectedHeadstock,
    neckTransformTarget,
    selectedNeckNode,
    setNeckTransformTarget,
  ]);

  useEffect(() => {
    if (selectedNeckNode) initNeckDraft(selectedNeckNode);
  }, [selectedNeckNode, initNeckDraft]);

  useEffect(() => {
    if (!selectedNode?.id || transformInputDraftByNodeId[selectedNode.id])
      return;
    const transforms = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };
    const draft = toTransformInputDraft({
      ...transforms,
      ...selectedNode?.transforms,
    });
    Object.entries(draft).forEach(([k, v]) =>
      setTransformInputValue(
        selectedNode.id,
        k as Parameters<typeof setTransformInputValue>[1],
        v,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id]);

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
    const onExit = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== projectId) return;
      flushProjectPreview();
    };
    window.addEventListener("project-workview-exit", onExit);
    return () => window.removeEventListener("project-workview-exit", onExit);
  }, [flushProjectPreview, projectId]);

  useEffect(
    () => () => {
      flushProjectPreview();
    },
    [flushProjectPreview],
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
        <SceneViewport
          nodeRefs={nodeRefs}
          headstockTranslateRefs={headstockTranslateRefs}
          headstockRotateScaleRefs={headstockRotateScaleRefs}
        />
        {selectedNeckNode ? (
          <NeckParamsPanel getGroupForNode={getGroupForNode} />
        ) : null}
      </div>

      <AssetLibraryPanel />
    </div>
  );
}
