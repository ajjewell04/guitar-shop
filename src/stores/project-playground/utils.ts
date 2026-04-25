import * as THREE from "three";
import type { NeckParams } from "@/lib/neck-params";
import {
  ROTATION_MIN,
  ROTATION_MAX,
  SCALE_MIN,
  SCALE_MAX,
  DEFAULT_NODE_TRANSFORMS,
  NUMERIC_NECK_META,
  NUMERIC_NECK_KEYS,
} from "./constants";
import type {
  NodeTransforms,
  TransformInputDraft,
  TransformInputKey,
  NumericNeckKey,
  Vec3,
} from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampRotation(value: number) {
  return clamp(value, ROTATION_MIN, ROTATION_MAX);
}

export function clampScale(value: number) {
  return clamp(value, SCALE_MIN, SCALE_MAX);
}

export function clampNeckNumber(key: NumericNeckKey, value: number) {
  const meta = NUMERIC_NECK_META[key];
  return clamp(value, meta.min, meta.max);
}

export function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isObjectInSceneGraph(
  obj: THREE.Object3D | null,
): obj is THREE.Object3D {
  if (!obj) return false;
  let cursor: THREE.Object3D | null = obj;
  let depth = 0;
  while (cursor && depth < 256) {
    if ((cursor as THREE.Scene).isScene) return true;
    cursor = cursor.parent;
    depth += 1;
  }
  return false;
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
      x: clampRotation(
        finiteNumber(rawRot?.x, DEFAULT_NODE_TRANSFORMS.rotation.x),
      ),
      y: clampRotation(
        finiteNumber(rawRot?.y, DEFAULT_NODE_TRANSFORMS.rotation.y),
      ),
      z: clampRotation(
        finiteNumber(rawRot?.z, DEFAULT_NODE_TRANSFORMS.rotation.z),
      ),
    },
    scale: clampScale(
      finiteNumber(transforms?.scale, DEFAULT_NODE_TRANSFORMS.scale),
    ),
  };
}

export function toTransformInputDraft(
  transforms: NodeTransforms,
): TransformInputDraft {
  return {
    positionX: String(transforms.position.x),
    positionY: String(transforms.position.y),
    positionZ: String(transforms.position.z),
    rotationX: String(transforms.rotation.x),
    rotationY: String(transforms.rotation.y),
    rotationZ: String(transforms.rotation.z),
    scale: String(transforms.scale),
  };
}

export function toNumericInputDraft(
  params: NeckParams,
): Record<NumericNeckKey, string> {
  return Object.fromEntries(
    NUMERIC_NECK_KEYS.map((k) => [k, String(params[k] as number)]),
  ) as Record<NumericNeckKey, string>;
}

export function neckParamsToHeadstockTransforms(
  params: NeckParams,
): NodeTransforms {
  return {
    position: {
      x: clampNeckNumber("headstockOffsetXMm", params.headstockOffsetXMm),
      y: clampNeckNumber("headstockOffsetYMm", params.headstockOffsetYMm),
      z: clampNeckNumber("headstockOffsetZMm", params.headstockOffsetZMm),
    },
    rotation: {
      x: clampNeckNumber("headstockRotXDeg", params.headstockRotXDeg),
      y: clampNeckNumber("headstockRotYDeg", params.headstockRotYDeg),
      z: clampNeckNumber("headstockRotZDeg", params.headstockRotZDeg),
    },
    scale: clampNeckNumber("headstockScale", params.headstockScale),
  };
}

export function headstockTransformsToNeckPatch(
  transforms: NodeTransforms,
): Partial<NeckParams> {
  return {
    headstockOffsetXMm: clampNeckNumber(
      "headstockOffsetXMm",
      transforms.position.x,
    ),
    headstockOffsetYMm: clampNeckNumber(
      "headstockOffsetYMm",
      transforms.position.y,
    ),
    headstockOffsetZMm: clampNeckNumber(
      "headstockOffsetZMm",
      transforms.position.z,
    ),
    headstockRotXDeg: clampNeckNumber(
      "headstockRotXDeg",
      transforms.rotation.x,
    ),
    headstockRotYDeg: clampNeckNumber(
      "headstockRotYDeg",
      transforms.rotation.y,
    ),
    headstockRotZDeg: clampNeckNumber(
      "headstockRotZDeg",
      transforms.rotation.z,
    ),
    headstockScale: clampNeckNumber("headstockScale", transforms.scale),
  };
}

export function updateTransformsByInputKey(
  transforms: NodeTransforms,
  key: TransformInputKey,
  value: number,
): NodeTransforms {
  if (key === "positionX")
    return { ...transforms, position: { ...transforms.position, x: value } };
  if (key === "positionY")
    return { ...transforms, position: { ...transforms.position, y: value } };
  if (key === "positionZ")
    return { ...transforms, position: { ...transforms.position, z: value } };
  if (key === "rotationX")
    return {
      ...transforms,
      rotation: { ...transforms.rotation, x: clampRotation(value) },
    };
  if (key === "rotationY")
    return {
      ...transforms,
      rotation: { ...transforms.rotation, y: clampRotation(value) },
    };
  if (key === "rotationZ")
    return {
      ...transforms,
      rotation: { ...transforms.rotation, z: clampRotation(value) },
    };
  return { ...transforms, scale: clampScale(value) };
}

export function clampHeadstockTransforms(
  transforms: NodeTransforms,
): NodeTransforms {
  return {
    position: {
      x: clampNeckNumber("headstockOffsetXMm", transforms.position.x),
      y: clampNeckNumber("headstockOffsetYMm", transforms.position.y),
      z: clampNeckNumber("headstockOffsetZMm", transforms.position.z),
    },
    rotation: {
      x: clampNeckNumber("headstockRotXDeg", transforms.rotation.x),
      y: clampNeckNumber("headstockRotYDeg", transforms.rotation.y),
      z: clampNeckNumber("headstockRotZDeg", transforms.rotation.z),
    },
    scale: clampNeckNumber("headstockScale", transforms.scale),
  };
}

export function vec3FromObject(obj: THREE.Object3D): Vec3 {
  return { x: obj.position.x, y: obj.position.y, z: obj.position.z };
}
