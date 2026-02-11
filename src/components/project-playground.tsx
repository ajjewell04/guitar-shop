"use client";

import { useEffect, useMemo, useState, Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Grid,
  Html,
  OrbitControls,
  TransformControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useLoader } from "@react-three/fiber";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { cn } from "@/lib/utils";

type ProjectPlaygroundProps = {
  projectId?: string;
  className?: string;
};

type ModelAsset = {
  id: string;
  name: string;
  url: string;
};

type RootNode = {
  id: string;
  name?: string;
};

type ModelsResponse = {
  url?: string;
  objUrl?: string;
  mtlUrl?: string;
  error?: string;
  root_node?: {
    id: string;
    name?: string | null;
    transforms?: {
      position?: { x: number; y: number; z: number };
    } | null;
  } | null;
};

function LoadingIndicator() {
  const { progress } = useProgress();
  return (
    <Html center className="rounded-md bg-black/60 px-3 py-2 text-xs">
      Loading {Math.round(progress)}%
    </Html>
  );
}

function ObjMtlView({ objUrl, mtlUrl }: { objUrl: string; mtlUrl: string }) {
  const materials = useLoader(MTLLoader, mtlUrl);
  const obj = useLoader(OBJLoader, objUrl, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  return <primitive object={obj} />;
}

function ModelAssetView({ url }: { url: string }) {
  const gltf = useGLTF(url) as unknown as GLTF;
  return <primitive object={gltf.scene} />;
}

function PlaceholderModel() {
  return (
    <mesh rotation={[0.4, 0.6, 0]} position={[0, 0.3, 0]}>
      <boxGeometry args={[1.2, 0.6, 1.2]} />
      <meshStandardMaterial color="#8ab7b1" roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

export default function ProjectPlayground({
  projectId,
  className,
}: ProjectPlaygroundProps) {
  const [model, setModel] = useState<ModelAsset | null>(null);
  const [objUrls, setObjUrls] = useState<{ obj: string; mtl: string } | null>(
    null,
  );
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const modelGroupRef = useRef<THREE.Group>(new THREE.Group());
  const transformControlsRef = useRef(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function scheduleSave() {
    if (!modelGroupRef.current || !model?.id) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(async () => {
      const pos = modelGroupRef.current!.position;
      setIsSaving(true);
      setSaveError(null);

      try {
        const res = await fetch("/api/models", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeId: model.id,
            position: { x: pos.x, y: pos.y, z: pos.z },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Save failed.");
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setIsSaving(false);
      }
    }, 400);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadModels() {
      setStatus("loading");
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/models?projectId=${projectId}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as ModelsResponse;
        if (!res.ok) {
          throw new Error(data?.error ?? "Failed to load models.");
        }
        setModel(
          data.url && data.root_node?.id
            ? {
                id: data.root_node.id,
                name: data.root_node.name ?? "Root model",
                url: data.url,
              }
            : null,
        );

        setObjUrls(
          data.objUrl && data.mtlUrl
            ? { obj: data.objUrl, mtl: data.mtlUrl }
            : null,
        );

        const savedPosition = data.root_node?.transforms?.position;
        if (savedPosition && modelGroupRef.current) {
          modelGroupRef.current.position.set(
            savedPosition.x ?? 0,
            savedPosition.y ?? 0,
            savedPosition.z ?? 0,
          );
        }
        setStatus("idle");
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Load failed.");
      }
    }

    loadModels();

    return () => controller.abort();
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "loading") return "Loading models...";
    if (status === "error") return errorMessage ?? "Unable to load models.";
    if (!model) return "No models found.";
    return `Showing: ${model.name ?? "Untitled model"}`;
  }, [status, errorMessage, model]);

  return (
    <div className={cn("flex h-full w-full flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Project {projectId ?? "Playground"}
        </div>
        <div className="text-xs text-muted-foreground">{statusLabel}</div>
      </div>
      <div className="relative h-[65vh] min-h-[420px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#0b1111]">
        <Canvas
          shadows
          camera={{ position: [3.5, 2.6, 4.2], fov: 45 }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
          }}
        >
          <color attach="background" args={["#0b1111"]} />
          <fog attach="fog" args={["#0b1111", 10, 35]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 8, 4]} intensity={1.3} castShadow />
          <pointLight position={[-4, -2, -6]} intensity={0.6} />
          <Grid
            args={[10, 10]}
            cellColor="#1e3a37"
            sectionColor="#2d5a55"
            fadeDistance={15}
            fadeStrength={1}
            position={[0, -0.5, 0]}
          />
          <Suspense fallback={<LoadingIndicator />}>
            <TransformControls
              ref={transformControlsRef}
              object={modelGroupRef}
              mode="translate"
              onMouseDown={() => setOrbitEnabled(false)}
              onMouseUp={() => setOrbitEnabled(true)}
              onObjectChange={() => scheduleSave()}
            >
              <group ref={modelGroupRef}>
                {objUrls ? (
                  <ObjMtlView objUrl={objUrls.obj} mtlUrl={objUrls.mtl} />
                ) : model?.url ? (
                  <Bounds fit clip observe margin={1.2}>
                    <Center>
                      <ModelAssetView url={model.url} />
                    </Center>
                  </Bounds>
                ) : (
                  <PlaceholderModel />
                )}
              </group>
            </TransformControls>
          </Suspense>
          <OrbitControls
            makeDefault
            enabled={orbitEnabled}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>
    </div>
  );
}
