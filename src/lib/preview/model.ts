import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createPreviewScene,
  canvasToBlob,
  PREVIEW_RIGHT_ELEVATION_RATIO,
} from "@/lib/preview/renderer";

export async function renderModelPreview(file: File): Promise<Blob> {
  const { canvas, renderer, scene, camera } = createPreviewScene();
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
    camera.position.set(distance, distance * PREVIEW_RIGHT_ELEVATION_RATIO, 0);
    camera.lookAt(0, 0, 0);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
    renderer.dispose();
  }
}
