"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { type NeckParams } from "@/lib/neck/params";
import { buildProceduralNeckMesh, getNeckNutAnchorXmm } from "@/lib/neck/mesh";

const WORLD_SCALE = 0.001;

export type HeadstockLoadStatus = "idle" | "loading" | "ready" | "error";

export type HeadstockLoadState = {
  status: HeadstockLoadStatus;
  message?: string | null;
};

type ProceduralNeckMeshProps = {
  params: NeckParams;
  headstockUrl?: string | null;
  headstockUnavailableError?: string | null;
  onHeadstockStateChange?: (state: HeadstockLoadState) => void;
  onHeadstockTranslateGroupChange?: (group: THREE.Group | null) => void;
  onHeadstockRotateScaleGroupChange?: (group: THREE.Group | null) => void;
  onHeadstockPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
};

type HeadstockErrorBoundaryProps = {
  resetKey: string;
  onError: (error: unknown) => void;
  children: React.ReactNode;
};

type HeadstockErrorBoundaryState = {
  hasError: boolean;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Failed to load headstock model.";
}

class HeadstockErrorBoundary extends React.Component<
  HeadstockErrorBoundaryProps,
  HeadstockErrorBoundaryState
> {
  state: HeadstockErrorBoundaryState = { hasError: false };

  componentDidCatch(error: unknown) {
    this.setState({ hasError: true });
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: HeadstockErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function HeadstockAttachment({
  url,
  params,
  onReady,
  onTranslateGroupChange,
  onRotateScaleGroupChange,
  onPointerDown,
}: {
  url: string;
  params: NeckParams;
  onReady: () => void;
  onTranslateGroupChange?: (group: THREE.Group | null) => void;
  onRotateScaleGroupChange?: (group: THREE.Group | null) => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const gltf = useGLTF(url) as { scene: THREE.Object3D };

  const { scene, unitScale } = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const inferredUnitScale = maxDim > 0 && maxDim < 2 ? 1000 : 1;
    cloned.position.sub(center);
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return { scene: cloned, unitScale: inferredUnitScale };
  }, [gltf.scene]);

  useEffect(() => {
    onReady();
  }, [onReady, scene, unitScale]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onPointerDown?.(event);
    },
    [onPointerDown],
  );

  return (
    <group position={[getNeckNutAnchorXmm(params), 0, 0]}>
      <group
        ref={onTranslateGroupChange}
        position={[
          params.headstockOffsetXMm,
          params.headstockOffsetYMm,
          params.headstockOffsetZMm,
        ]}
        onPointerDown={handlePointerDown}
      >
        <group
          rotation={[0, THREE.MathUtils.degToRad(-params.tiltbackAngleDeg), 0]}
        >
          <group
            ref={onRotateScaleGroupChange}
            rotation={[
              THREE.MathUtils.degToRad(params.headstockRotXDeg),
              THREE.MathUtils.degToRad(params.headstockRotYDeg),
              THREE.MathUtils.degToRad(params.headstockRotZDeg),
            ]}
            scale={[
              params.headstockScale,
              params.headstockScale,
              params.headstockScale,
            ]}
            onPointerDown={handlePointerDown}
          >
            <group scale={[unitScale, unitScale, unitScale]}>
              <primitive object={scene} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function ProceduralNeckMesh({
  params,
  headstockUrl = null,
  headstockUnavailableError = null,
  onHeadstockStateChange,
  onHeadstockTranslateGroupChange,
  onHeadstockRotateScaleGroupChange,
  onHeadstockPointerDown,
}: ProceduralNeckMeshProps) {
  const onHeadstockStateRef = useRef(onHeadstockStateChange);

  useEffect(() => {
    onHeadstockStateRef.current = onHeadstockStateChange;
  }, [onHeadstockStateChange]);

  const emitHeadstockState = useCallback((state: HeadstockLoadState) => {
    onHeadstockStateRef.current?.(state);
  }, []);

  const neckObject = useMemo(
    () => buildProceduralNeckMesh(params),
    [JSON.stringify(params)],
  );

  const onHeadstockReady = useCallback(() => {
    emitHeadstockState({ status: "ready", message: null });
  }, [emitHeadstockState]);

  const onHeadstockError = useCallback(
    (error: unknown) => {
      emitHeadstockState({
        status: "error",
        message: toErrorMessage(error),
      });
    },
    [emitHeadstockState],
  );

  useEffect(() => {
    if (headstockUnavailableError) {
      emitHeadstockState({
        status: "error",
        message: headstockUnavailableError,
      });
      return;
    }
    if (!headstockUrl) {
      emitHeadstockState({ status: "idle", message: null });
      return;
    }
    emitHeadstockState({ status: "loading", message: null });
  }, [emitHeadstockState, headstockUnavailableError, headstockUrl]);

  return (
    <group
      scale={[WORLD_SCALE, WORLD_SCALE, WORLD_SCALE]}
      rotation={[0, THREE.MathUtils.degToRad(params.neckAngleDeg), 0]}
    >
      <primitive object={neckObject} />

      {headstockUrl && !headstockUnavailableError ? (
        <HeadstockErrorBoundary
          resetKey={headstockUrl}
          onError={onHeadstockError}
        >
          <Suspense fallback={null}>
            <HeadstockAttachment
              url={headstockUrl}
              params={params}
              onReady={onHeadstockReady}
              onTranslateGroupChange={onHeadstockTranslateGroupChange}
              onRotateScaleGroupChange={onHeadstockRotateScaleGroupChange}
              onPointerDown={onHeadstockPointerDown}
            />
          </Suspense>
        </HeadstockErrorBoundary>
      ) : null}
    </group>
  );
}
