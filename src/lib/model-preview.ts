import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export async function renderModelPreview(file: File): Promise<Blob> {
  const width = 640;
  const height = 640;
  const background = 0xf4f4f4;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 1000);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  const loader = new GLTFLoader();
  const objectUrl = URL.createObjectURL(file);

  try {
    const gltf = await loader.loadAsync(objectUrl);
    const root = gltf.scene;
    scene.add(root);

    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = maxDim * 1.2;
    camera.position.set(distance * 0.7, distance * 0.5, distance);
    camera.lookAt(0, 0, 0);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      }, "image/png");
    });
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
    renderer.dispose();
  }
}
