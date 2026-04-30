import * as THREE from "three";

type Vec3 = { x: number; y: number; z: number };

type NodeTransforms = {
  position: Vec3;
  rotation: Vec3;
  scale: number;
};

type HierarchyNodeLike = {
  id: string;
  parent_id: string | null;
  transforms?: {
    position?: Vec3;
    rotation?: Vec3;
    scale?: number;
  } | null;
};

export const DEFAULT_NODE_TRANSFORMS: NodeTransforms = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeNodeTransforms(
  transforms?: Partial<NodeTransforms> | null,
): NodeTransforms {
  const rawPos = transforms?.position;
  const rawRot = transforms?.rotation;
  return {
    position: {
      x: finiteNumber(rawPos?.x, DEFAULT_NODE_TRANSFORMS.position.x),
      y: finiteNumber(rawPos?.y, DEFAULT_NODE_TRANSFORMS.position.y),
      z: finiteNumber(rawPos?.z, DEFAULT_NODE_TRANSFORMS.position.z),
    },
    rotation: {
      x: finiteNumber(rawRot?.x, DEFAULT_NODE_TRANSFORMS.rotation.x),
      y: finiteNumber(rawRot?.y, DEFAULT_NODE_TRANSFORMS.rotation.y),
      z: finiteNumber(rawRot?.z, DEFAULT_NODE_TRANSFORMS.rotation.z),
    },
    scale: finiteNumber(transforms?.scale, DEFAULT_NODE_TRANSFORMS.scale),
  };
}

export function nodeTransformsToMatrix(
  transforms: NodeTransforms,
): THREE.Matrix4 {
  const position = new THREE.Vector3(
    transforms.position.x,
    transforms.position.y,
    transforms.position.z,
  );
  const rotation = new THREE.Euler(
    THREE.MathUtils.degToRad(transforms.rotation.x),
    THREE.MathUtils.degToRad(transforms.rotation.y),
    THREE.MathUtils.degToRad(transforms.rotation.z),
  );
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scale = new THREE.Vector3(
    transforms.scale,
    transforms.scale,
    transforms.scale,
  );
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

export function nodeTransformsFromMatrix(
  matrix: THREE.Matrix4,
): NodeTransforms {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z),
    },
    scale: scale.x,
  };
}

export function buildWorldMatrixByNodeId(
  nodes: HierarchyNodeLike[],
): Map<string, THREE.Matrix4> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, THREE.Matrix4>();
  const visiting = new Set<string>();

  const visit = (nodeId: string): THREE.Matrix4 => {
    const cached = cache.get(nodeId);
    if (cached) return cached.clone();

    if (visiting.has(nodeId)) {
      return new THREE.Matrix4().identity();
    }

    visiting.add(nodeId);

    const node = byId.get(nodeId);
    if (!node) {
      visiting.delete(nodeId);
      return new THREE.Matrix4().identity();
    }

    const local = nodeTransformsToMatrix(
      normalizeNodeTransforms(node.transforms),
    );
    const parentId = node.parent_id;
    let world = local.clone();

    if (parentId && byId.has(parentId)) {
      const parentWorld = visit(parentId);
      world = parentWorld.multiply(local);
    }

    cache.set(nodeId, world.clone());
    visiting.delete(nodeId);
    return world;
  };

  for (const node of nodes) {
    visit(node.id);
  }

  return cache;
}

export function buildWorldTransformsByNodeId(
  nodes: HierarchyNodeLike[],
): Map<string, NodeTransforms> {
  const worldMatrices = buildWorldMatrixByNodeId(nodes);
  const worldTransforms = new Map<string, NodeTransforms>();
  for (const [id, matrix] of worldMatrices.entries()) {
    worldTransforms.set(id, nodeTransformsFromMatrix(matrix));
  }
  return worldTransforms;
}
