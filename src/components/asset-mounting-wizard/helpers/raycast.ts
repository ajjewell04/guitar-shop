import * as THREE from "three";

// Surface raycast + vertex-snap helpers used by part-type steps in PR 3+.
// Shipped here so the click controller is ready when those steps land.

export function buildRaycaster(): THREE.Raycaster {
  return new THREE.Raycaster();
}

export function surfaceRaycast(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  objects: THREE.Object3D[],
): THREE.Intersection | null {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(objects, true);
  return hits[0] ?? null;
}

// Shift-modifier: snap the hit point to the nearest mesh vertex within snapRadius.
export function vertexSnap(
  hit: THREE.Intersection,
  snapRadius: number,
): THREE.Vector3 | null {
  const mesh = hit.object as THREE.Mesh;
  const geo = mesh.geometry;
  if (!geo.attributes.position) return null;

  const pos = geo.attributes.position;
  const worldPoint = hit.point;
  let best: THREE.Vector3 | null = null;
  let bestDist = snapRadius;

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const d = v.distanceTo(worldPoint);
    if (d < bestDist) {
      bestDist = d;
      best = v.clone();
    }
  }

  return best;
}
