"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ThreeDemo() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  type ModelInfo = { url: string };
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        const first = data?.models?.[0] ?? null;
        console.log("models:", data?.models);
        setModelInfo(first);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!modelInfo?.url) return;

    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1113);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(4, 4, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    let model: THREE.Object3D | null = null;

    const loader = new GLTFLoader();
    loader.load(
      modelInfo.url,
      (gltf) => {
        model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        model.position.sub(center);
        model.rotateZ(THREE.MathUtils.degToRad(90));
        scene.add(model);

        camera.position.set(0, 0, size * 1);
        camera.near = size / 100;
        camera.far = size * 100;
        camera.updateProjectionMatrix();
      },
      undefined,
      (error) => console.error("GLTF load error:", error),
    );

    let frameId = 0;

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };

    const animate = () => {
      if (model) {
        model.rotation.x += 0.006;
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener("resize", resize);
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelInfo]);

  return <div ref={containerRef} className="overflow-hidden" />;
}
