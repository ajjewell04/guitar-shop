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
import { cn } from "@/lib/utils";
import ProceduralNeckMesh, {
  type HeadstockLoadState,
} from "@/components/project-playground/procedural-neck-mesh";
import { useProjectPlaygroundStore } from "@/stores/project-playground/store";
import { TRANSFORM_MODES } from "@/stores/project-playground/constants";
import {
  normalizeNodeTransforms,
  isObjectInSceneGraph,
  clampRotation,
  clampScale,
} from "@/stores/project-playground/utils";
import type { ProjectNode } from "@/stores/project-playground/types";
import type {
  TransformMode,
  NeckTransformTarget,
} from "@/stores/project-playground/types";
import { TransformSection } from "./transform-section";

// ─── Three.js helpers ─────────────────────────────────────────────────────────

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
      scene.position.sub(box.getCenter(new THREE.Vector3()));
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

// ─── Scene viewport ───────────────────────────────────────────────────────────

type SceneViewportProps = {
  nodeRefs: RefObject<Record<string, THREE.Group | null>>;
  headstockTranslateRefs: RefObject<Record<string, THREE.Group | null>>;
  headstockRotateScaleRefs: RefObject<Record<string, THREE.Group | null>>;
};

export function SceneViewport({
  nodeRefs,
  headstockTranslateRefs,
  headstockRotateScaleRefs,
}: SceneViewportProps) {
  // Store state
  const nodes = useProjectPlaygroundStore((s) => s.nodes);
  const selectedNodeId = useProjectPlaygroundStore((s) => s.selectedNodeId);
  const deletingNodeId = useProjectPlaygroundStore((s) => s.deletingNodeId);
  const orbitEnabled = useProjectPlaygroundStore((s) => s.orbitEnabled);
  const transformMode = useProjectPlaygroundStore((s) => s.transformMode);
  const neckTransformTarget = useProjectPlaygroundStore(
    (s) => s.neckTransformTarget,
  );
  const loadedNodeIds = useProjectPlaygroundStore((s) => s.loadedNodeIds);
  const assemblyWarnings = useProjectPlaygroundStore((s) => s.assemblyWarnings);
  const hideModelLoadBadge = useProjectPlaygroundStore(
    (s) => s.hideModelLoadBadge,
  );
  const modelLoadBadgeTimedOut = useProjectPlaygroundStore(
    (s) => s.modelLoadBadgeTimedOut,
  );
  const libraryAssets = useProjectPlaygroundStore((s) => s.libraryAssets);

  // Store actions
  const setSelectedNodeId = useProjectPlaygroundStore(
    (s) => s.setSelectedNodeId,
  );
  const setTransformMode = useProjectPlaygroundStore((s) => s.setTransformMode);
  const setNeckTransformTarget = useProjectPlaygroundStore(
    (s) => s.setNeckTransformTarget,
  );
  const setOrbitEnabled = useProjectPlaygroundStore((s) => s.setOrbitEnabled);
  const markNodeLoaded = useProjectPlaygroundStore((s) => s.markNodeLoaded);
  const resetLoadedNodes = useProjectPlaygroundStore((s) => s.resetLoadedNodes);
  const setHideModelLoadBadge = useProjectPlaygroundStore(
    (s) => s.setHideModelLoadBadge,
  );
  const setModelLoadBadgeTimedOut = useProjectPlaygroundStore(
    (s) => s.setModelLoadBadgeTimedOut,
  );
  const deleteSelectedNode = useProjectPlaygroundStore(
    (s) => s.deleteSelectedNode,
  );
  const scheduleTransformSave = useProjectPlaygroundStore(
    (s) => s.scheduleTransformSave,
  );
  const getNeckParamsForNode = useProjectPlaygroundStore(
    (s) => s.getNeckParamsForNode,
  );
  const getHeadstockTransformsForNode = useProjectPlaygroundStore(
    (s) => s.getHeadstockTransformsForNode,
  );
  const setHeadstockLoadState = useProjectPlaygroundStore(
    (s) => s.setHeadstockLoadState,
  );
  const applyHeadstockTransformsToDraft = useProjectPlaygroundStore(
    (s) => s.applyHeadstockTransformsToDraft,
  );

  // Own Three.js refs
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const transformRef = useRef<TransformControlsImpl | null>(null);
  const transformPointerDownRef = useRef(false);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const recenterRafRef = useRef<number | null>(null);

  // selectedObject — derived from Three.js refs + store
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(
    null,
  );

  const resolveSelectedObject = useCallback(
    (
      nodeId: string | null,
      mode: TransformMode,
      neckTarget: NeckTransformTarget,
    ): THREE.Object3D | null => {
      if (!nodeId) return null;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const isNeck = node.asset?.part_type === "neck";
      if (!isNeck || neckTarget === "neck")
        return nodeRefs.current[nodeId] ?? null;
      if (mode === "translate")
        return headstockTranslateRefs.current[nodeId] ?? null;
      return headstockRotateScaleRefs.current[nodeId] ?? null;
    },
    [nodes, nodeRefs, headstockTranslateRefs, headstockRotateScaleRefs],
  );

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

  useEffect(() => {
    if (!selectedNodeId) setSelectedObject(null);
  }, [selectedNodeId]);

  // Camera recentering
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

      const t0 = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const p = Math.min((now - t0) / 260, 1);
        const e = easeOutCubic(p);
        camera.position.lerpVectors(startPos, endPos, e);
        controls.target.lerpVectors(startTarget, endTarget, e);
        controls.update();
        recenterRafRef.current =
          p < 1 ? window.requestAnimationFrame(tick) : null;
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
      recenterCameraTo(getObjectWorldCenter(obj), animate);
    },
    [selectedNodeId, nodeRefs, getObjectWorldCenter, recenterCameraTo],
  );

  // Transform helpers
  const shouldIgnoreSceneSelection = useCallback(() => {
    const c = transformRef.current as unknown as {
      dragging?: boolean;
      axis?: string | null;
    } | null;
    return (
      transformPointerDownRef.current ||
      c?.dragging === true ||
      (c?.axis ?? null) !== null
    );
  }, []);

  const getActiveAxisUniformScale = useCallback((obj: THREE.Object3D) => {
    const axis =
      (transformRef.current as unknown as { axis?: string | null } | null)
        ?.axis ?? "";
    if (axis.includes("X")) return obj.scale.x;
    if (axis.includes("Y")) return obj.scale.y;
    if (axis.includes("Z")) return obj.scale.z;
    return obj.scale.x;
  }, []);

  function snapshotNodeTransforms(obj: THREE.Object3D, mode: TransformMode) {
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
    const scale = clampScale(
      mode === "scale" ? getActiveAxisUniformScale(obj) : obj.scale.x,
    );
    obj.scale.setScalar(scale);
    return {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation,
      scale,
    };
  }

  function snapshotHeadstockTransforms(nodeId: string, mode: TransformMode) {
    const current = getHeadstockTransformsForNode(nodeId);
    const translateObj = headstockTranslateRefs.current[nodeId];
    const rotateScaleObj = headstockRotateScaleRefs.current[nodeId];

    const position = { ...current.position };
    if (translateObj) {
      position.x = translateObj.position.x;
      position.y = translateObj.position.y;
      position.z = translateObj.position.z;
      translateObj.position.set(position.x, position.y, position.z);
    }

    const rotation = { ...current.rotation };
    let scale = current.scale;
    if (rotateScaleObj) {
      rotation.x = clampRotation(
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.x),
      );
      rotation.y = clampRotation(
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.y),
      );
      rotation.z = clampRotation(
        THREE.MathUtils.radToDeg(rotateScaleObj.rotation.z),
      );
      rotateScaleObj.rotation.set(
        THREE.MathUtils.degToRad(rotation.x),
        THREE.MathUtils.degToRad(rotation.y),
        THREE.MathUtils.degToRad(rotation.z),
      );
      scale = clampScale(
        mode === "scale"
          ? getActiveAxisUniformScale(rotateScaleObj)
          : rotateScaleObj.scale.x,
      );
      rotateScaleObj.scale.setScalar(scale);
    }
    return { position, rotation, scale };
  }

  // Derived
  const headstockAssetById = useMemo(
    () =>
      new Map(
        libraryAssets
          .filter((a) => a.part_type === "headstock")
          .map((a) => [a.id, a]),
      ),
    [libraryAssets],
  );

  const getHeadstockRenderState = useCallback(
    (params: ReturnType<typeof getNeckParamsForNode>) => {
      if (!params?.headstockAssetId)
        return {
          url: null as string | null,
          unavailableError: null as string | null,
        };
      const asset = headstockAssetById.get(params.headstockAssetId) ?? null;
      const url = asset?.modelUrl ?? null;
      return {
        url,
        unavailableError: !asset
          ? "Selected headstock is not available in your library."
          : !url
            ? "Selected headstock does not have a model file yet."
            : null,
      };
    },
    [headstockAssetById, getNeckParamsForNode],
  );

  const expectedModelNodes = useMemo(
    () =>
      nodes
        .filter((n) => !!n.asset?.modelUrl && n.asset?.part_type !== "neck")
        .map((n) => n.id),
    [nodes],
  );
  const expectedKey = expectedModelNodes.join("|");

  const loadProgress = useMemo(() => {
    const total = expectedModelNodes.length;
    if (total === 0) return { total, loaded: 0, pct: 100 };
    let loaded = 0;
    for (const id of expectedModelNodes) if (loadedNodeIds.has(id)) loaded++;
    return { total, loaded, pct: Math.round((loaded / total) * 100) };
  }, [expectedModelNodes, loadedNodeIds]);

  const isModelLoading =
    loadProgress.total > 0 && loadProgress.loaded < loadProgress.total;

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedNeckNode = useMemo(
    () => (selectedNode?.asset?.part_type === "neck" ? selectedNode : null),
    [selectedNode],
  );
  const selectedBodyOrNeckNode = useMemo(() => {
    const t = selectedNode?.asset?.part_type;
    return t === "body" || t === "neck";
  }, [selectedNode]);

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
        [...bucket].sort((a, b) =>
          a.sort_index !== b.sort_index
            ? a.sort_index - b.sort_index
            : a.id.localeCompare(b.id),
        ),
      );
    }
    return map;
  }, [nodes]);

  const sceneRootNodes = useMemo(() => {
    const byId = new Set(nodes.map((n) => n.id));
    return nodes
      .filter((n) => !n.parent_id || !byId.has(n.parent_id))
      .sort((a, b) =>
        a.sort_index !== b.sort_index
          ? a.sort_index - b.sort_index
          : a.id.localeCompare(b.id),
      );
  }, [nodes]);

  // Effects

  useEffect(() => {
    resetLoadedNodes();
    setHideModelLoadBadge(false);
    setModelLoadBadgeTimedOut(false);
  }, [expectedKey]);

  useEffect(() => {
    if (!isModelLoading) {
      setModelLoadBadgeTimedOut(false);
      return;
    }
    const t = window.setTimeout(() => setModelLoadBadgeTimedOut(true), 8000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModelLoading, expectedKey]);

  useEffect(() => {
    if (!selectedNodeId) return;
    const raf = window.requestAnimationFrame(() =>
      recenterToSelectedNode(true),
    );
    return () => window.cancelAnimationFrame(raf);
  }, [selectedNodeId, recenterToSelectedNode]);

  useEffect(
    () => () => {
      if (recenterRafRef.current)
        window.cancelAnimationFrame(recenterRafRef.current);
    },
    [],
  );

  // Scene graph renderer
  const renderSceneNode = useCallback(
    (node: ProjectNode) => {
      const {
        position: pos,
        rotation: rot,
        scale,
      } = normalizeNodeTransforms(node.transforms);
      const isNeck = node.asset?.part_type === "neck";
      const isBody = node.asset?.part_type === "body";
      const neckParams = getNeckParamsForNode(node);
      const hsRenderState = getHeadstockRenderState(neckParams);
      const children = sortedNodesByParentId.get(node.id) ?? [];
      if (
        !(isNeck ? !!neckParams : !!node.asset?.modelUrl) &&
        children.length === 0
      )
        return null;

      return (
        <group
          key={node.id}
          ref={(g) => {
            nodeRefs.current[node.id] = g;
            if (node.id === selectedNodeId)
              setSelectedObject(
                resolveSelectedObject(
                  node.id,
                  transformMode,
                  neckTransformTarget,
                ),
              );
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
            if (isNeck) setNeckTransformTarget("neck");
          }}
        >
          <Suspense fallback={null}>
            {isNeck && neckParams ? (
              <ProceduralNeckMesh
                params={neckParams}
                headstockUrl={hsRenderState.url}
                headstockUnavailableError={hsRenderState.unavailableError}
                onHeadstockStateChange={(state: HeadstockLoadState) =>
                  setHeadstockLoadState(node.id, state)
                }
                onHeadstockTranslateGroupChange={(group) => {
                  headstockTranslateRefs.current[node.id] = group;
                  if (
                    node.id === selectedNodeId &&
                    neckTransformTarget === "headstock" &&
                    transformMode === "translate"
                  )
                    setSelectedObject(
                      resolveSelectedObject(
                        node.id,
                        transformMode,
                        neckTransformTarget,
                      ),
                    );
                }}
                onHeadstockRotateScaleGroupChange={(group) => {
                  headstockRotateScaleRefs.current[node.id] = group;
                  if (
                    node.id === selectedNodeId &&
                    neckTransformTarget === "headstock" &&
                    transformMode !== "translate"
                  )
                    setSelectedObject(
                      resolveSelectedObject(
                        node.id,
                        transformMode,
                        neckTransformTarget,
                      ),
                    );
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
      getNeckParamsForNode,
      getHeadstockRenderState,
      markNodeLoaded,
      neckTransformTarget,
      nodeRefs,
      headstockTranslateRefs,
      headstockRotateScaleRefs,
      resolveSelectedObject,
      selectedNodeId,
      setHeadstockLoadState,
      setNeckTransformTarget,
      setSelectedNodeId,
      sortedNodesByParentId,
      transformMode,
      shouldIgnoreSceneSelection,
    ],
  );

  return (
    <div className="relative h-[58vh] min-h-90 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1111]">
      {/* Transform overlay — shown for non-neck selections */}
      {selectedNode && selectedObject && !selectedNeckNode ? (
        <div className="absolute left-3 top-3 z-10 w-70">
          <TransformSection nodeId={selectedNode.id} mode={transformMode} />
        </div>
      ) : null}

      {/* Assembly warnings */}
      {selectedBodyOrNeckNode && assemblyWarnings.length > 0 ? (
        <div className="absolute left-3 bottom-3 z-10 w-90 rounded border border-amber-300/60 bg-black/70 px-3 py-2">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
            Body-Neck Warnings
          </div>
          <div className="space-y-1 text-xs text-amber-100">
            {assemblyWarnings.map((w) => (
              <div key={w.id}>{w.message}</div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Toolbar */}
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
          onClick={() => void deleteSelectedNode()}
        >
          {deletingNodeId ? "Deleting..." : "Delete"}
        </button>
      </div>

      {/* Canvas */}
      <Canvas
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
            key={`${selectedNodeId}:${neckTransformTarget}`}
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
              if (!selectedNodeId) return;
              const node = nodes.find((n) => n.id === selectedNodeId);
              if (!node) return;
              if (
                node.asset?.part_type === "neck" &&
                neckTransformTarget === "headstock"
              ) {
                applyHeadstockTransformsToDraft(
                  selectedNodeId,
                  snapshotHeadstockTransforms(selectedNodeId, transformMode),
                );
                return;
              }
              const obj = nodeRefs.current[selectedNodeId];
              if (!obj) return;
              scheduleTransformSave(
                selectedNodeId,
                snapshotNodeTransforms(obj, transformMode),
              );
            }}
          />
        ) : null}
        <TransformControlsSync
          controlsRef={transformRef}
          object={selectedObject}
        />

        {isModelLoading && !hideModelLoadBadge && !modelLoadBadgeTimedOut ? (
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
  );
}
