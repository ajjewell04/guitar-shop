import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const PREVIEW_RIGHT_ELEVATION_RATIO = 0.28;

export type PreviewNodeInput = {
  modelUrl: string;
  position?: { x: number; y: number; z: number } | null;
  rotation?: { x: number; y: number; z: number } | null;
  scale?: number | null;
};

export async function renderProjectPreview(
  nodes: PreviewNodeInput[],
): Promise<Blob> {
  if (!nodes.length) {
    throw new Error("No nodes to render");
  }

  const width = 640;
  const height = 640;

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
  const root = new THREE.Group();
  scene.add(root);

  try {
    await Promise.all(
      nodes.map(async (node) => {
        const gltf = await loader.loadAsync(node.modelUrl);
        const model = gltf.scene.clone(true);

        const modelBox = new THREE.Box3().setFromObject(model);
        const modelCenter = modelBox.getCenter(new THREE.Vector3());
        model.position.sub(modelCenter);

        const placed = new THREE.Group();
        const pos = node.position ?? { x: 0, y: 0, z: 0 };
        const rot = node.rotation ?? { x: 0, y: 0, z: 0 };
        const scale = THREE.MathUtils.clamp(node.scale ?? 1, 0.01, 10);
        placed.position.set(pos.x, pos.y, pos.z);
        placed.rotation.set(
          THREE.MathUtils.degToRad(rot.x),
          THREE.MathUtils.degToRad(rot.y),
          THREE.MathUtils.degToRad(rot.z),
        );
        placed.scale.setScalar(scale);
        placed.add(model);

        root.add(placed);
      }),
    );

    const box = new THREE.Box3().setFromObject(root);
    if (!Number.isFinite(box.min.x)) {
      throw new Error("No renderable scene");
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const distance = maxDim * 1.2;

    camera.position.set(distance, distance * PREVIEW_RIGHT_ELEVATION_RATIO, 0);
    camera.lookAt(0, 0, 0);
    camera.near = Math.max(maxDim / 100, 0.001);
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      }, "image/png");
    });
  } finally {
    renderer.dispose();
  }
}
