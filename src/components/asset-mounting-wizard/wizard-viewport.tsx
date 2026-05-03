"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useWizard } from "./wizard-state";
import { axisAssignmentToFrameRotation } from "./helpers/axis-assignment";
import type { Vec3 } from "@/lib/guitar/schema";

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

type ModelSceneProps = {
  modelUrl: string;
  frameRotation: Vec3;
};

function ModelScene({ modelUrl, frameRotation }: ModelSceneProps) {
  const { scene } = useGLTF(modelUrl);

  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    return clone;
  }, [scene]);

  return (
    <group
      rotation={[
        degToRad(frameRotation.x),
        degToRad(frameRotation.y),
        degToRad(frameRotation.z),
      ]}
    >
      <primitive object={cloned} />
    </group>
  );
}

function IdentityAxesHelper() {
  return <axesHelper args={[1]} />;
}

type WizardViewportProps = {
  modelUrl: string;
};

export function WizardViewport({ modelUrl }: WizardViewportProps) {
  const { state } = useWizard();
  const { forwardAxis, upAxis } = state.draft;

  const frameRotation = useMemo((): Vec3 => {
    if (!forwardAxis || !upAxis) return { x: 0, y: 0, z: 0 };
    try {
      return axisAssignmentToFrameRotation({
        canonicalForward: forwardAxis,
        canonicalUp: upAxis,
      });
    } catch {
      return { x: 0, y: 0, z: 0 };
    }
  }, [forwardAxis, upAxis]);

  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [4.8, 3.2, 5.2], fov: 45 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.3} />
        <pointLight position={[-5, -5, -5]} intensity={0.6} />

        <OrbitControls enableDamping />

        <IdentityAxesHelper />

        <Suspense fallback={null}>
          <ModelScene modelUrl={modelUrl} frameRotation={frameRotation} />
        </Suspense>
      </Canvas>
    </div>
  );
}
