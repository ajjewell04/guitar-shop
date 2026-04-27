import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  clampRotation,
  clampScale,
  isObjectInSceneGraph,
  normalizeNodeTransforms,
  toTransformInputDraft,
  toNumericInputDraft,
  updateTransformsByInputKey,
  neckParamsToHeadstockTransforms,
  headstockTransformsToNeckPatch,
  clampHeadstockTransforms,
} from "@/stores/project-playground/utils";
import {
  ROTATION_MIN,
  ROTATION_MAX,
  SCALE_MIN,
  SCALE_MAX,
  DEFAULT_NODE_TRANSFORMS,
  NUMERIC_NECK_KEYS,
} from "@/stores/project-playground/constants";
import { DEFAULT_NECK_PARAMS } from "@/lib/neck/params";

describe("isObjectInSceneGraph", () => {
  it("returns false for null", () => {
    expect(isObjectInSceneGraph(null)).toBe(false);
  });

  it("returns false for a detached Object3D with no parent", () => {
    const obj = new THREE.Mesh();
    expect(isObjectInSceneGraph(obj)).toBe(false);
  });

  it("returns true when the object is added to a Scene", () => {
    const scene = new THREE.Scene();
    const obj = new THREE.Mesh();
    scene.add(obj);
    expect(isObjectInSceneGraph(obj)).toBe(true);
  });

  it("returns true for a deeply nested object whose ancestor is a Scene", () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    const child = new THREE.Mesh();
    scene.add(parent);
    parent.add(child);
    expect(isObjectInSceneGraph(child)).toBe(true);
  });
});

describe("clampRotation", () => {
  it("clamps below ROTATION_MIN to ROTATION_MIN", () => {
    expect(clampRotation(-400)).toBe(ROTATION_MIN);
  });

  it("clamps above ROTATION_MAX to ROTATION_MAX", () => {
    expect(clampRotation(400)).toBe(ROTATION_MAX);
  });

  it("passes through an in-range value unchanged", () => {
    expect(clampRotation(90)).toBe(90);
  });
});

describe("clampScale", () => {
  it("clamps below SCALE_MIN to SCALE_MIN", () => {
    expect(clampScale(-1)).toBe(SCALE_MIN);
    expect(clampScale(0)).toBe(SCALE_MIN);
  });

  it("clamps above SCALE_MAX to SCALE_MAX", () => {
    expect(clampScale(15)).toBe(SCALE_MAX);
  });

  it("passes through an in-range value unchanged", () => {
    expect(clampScale(5)).toBe(5);
  });
});

describe("normalizeNodeTransforms (store)", () => {
  it("returns DEFAULT_NODE_TRANSFORMS when called with null", () => {
    expect(normalizeNodeTransforms(null)).toEqual(DEFAULT_NODE_TRANSFORMS);
  });

  it("clamps out-of-range rotation rather than replacing with default", () => {
    const result = normalizeNodeTransforms({
      rotation: { x: 400, y: -400, z: 0 },
    });
    expect(result.rotation.x).toBe(ROTATION_MAX);
    expect(result.rotation.y).toBe(ROTATION_MIN);
  });

  it("clamps out-of-range scale rather than replacing with default", () => {
    const result = normalizeNodeTransforms({ scale: 15 });
    expect(result.scale).toBe(SCALE_MAX);
  });
});

describe("toTransformInputDraft", () => {
  it("converts all numeric transform values to strings", () => {
    const draft = toTransformInputDraft(DEFAULT_NODE_TRANSFORMS);
    expect(draft).toEqual({
      positionX: "0",
      positionY: "0",
      positionZ: "0",
      rotationX: "0",
      rotationY: "0",
      rotationZ: "0",
      scale: "1",
    });
  });

  it("preserves zero values as '0' rather than empty string", () => {
    const draft = toTransformInputDraft({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 0.01,
    });
    expect(draft.positionX).toBe("0");
    expect(draft.scale).toBe("0.01");
  });
});

describe("toNumericInputDraft", () => {
  it("converts all NeckParams numeric values to strings", () => {
    const draft = toNumericInputDraft(DEFAULT_NECK_PARAMS);
    expect(Object.keys(draft)).toHaveLength(NUMERIC_NECK_KEYS.length);
    for (const key of NUMERIC_NECK_KEYS) {
      expect(typeof draft[key]).toBe("string");
    }
  });

  it("preserves the default scaleLengthIn value as a string", () => {
    const draft = toNumericInputDraft(DEFAULT_NECK_PARAMS);
    expect(draft.scaleLengthIn).toBe(String(DEFAULT_NECK_PARAMS.scaleLengthIn));
  });
});

describe("updateTransformsByInputKey", () => {
  const base = DEFAULT_NODE_TRANSFORMS;

  it("updates position.x when key is positionX", () => {
    const result = updateTransformsByInputKey(base, "positionX", 5);
    expect(result.position.x).toBe(5);
    expect(result.position.y).toBe(base.position.y);
  });

  it("updates position.y when key is positionY", () => {
    expect(updateTransformsByInputKey(base, "positionY", -3).position.y).toBe(
      -3,
    );
  });

  it("clamps rotation to ROTATION_MAX when key is rotationX", () => {
    const result = updateTransformsByInputKey(base, "rotationX", 400);
    expect(result.rotation.x).toBe(ROTATION_MAX);
  });

  it("clamps rotation to ROTATION_MIN when key is rotationY", () => {
    const result = updateTransformsByInputKey(base, "rotationY", -400);
    expect(result.rotation.y).toBe(ROTATION_MIN);
  });

  it("clamps rotation when key is rotationZ", () => {
    expect(updateTransformsByInputKey(base, "rotationZ", 400).rotation.z).toBe(
      ROTATION_MAX,
    );
  });

  it("clamps scale to SCALE_MAX when key is scale", () => {
    const result = updateTransformsByInputKey(base, "scale", 15);
    expect(result.scale).toBe(SCALE_MAX);
  });
});

describe("neckParamsToHeadstockTransforms", () => {
  it("returns default-zeroed transforms for DEFAULT_NECK_PARAMS", () => {
    const transforms = neckParamsToHeadstockTransforms(DEFAULT_NECK_PARAMS);
    expect(transforms.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(transforms.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(transforms.scale).toBe(1);
  });
});

describe("clampHeadstockTransforms", () => {
  it("passes through in-range values unchanged", () => {
    const transforms = {
      position: { x: 10, y: -5, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };
    const result = clampHeadstockTransforms(transforms);
    expect(result.position.x).toBe(10);
    expect(result.position.y).toBe(-5);
    expect(result.scale).toBe(1);
  });

  it("clamps headstock offsets to their bounds", () => {
    const transforms = {
      position: { x: 600, y: -600, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };
    const result = clampHeadstockTransforms(transforms);
    expect(result.position.x).toBe(500);
    expect(result.position.y).toBe(-500);
  });

  it("clamps headstock scale to its bounds", () => {
    const transforms = {
      ...DEFAULT_NODE_TRANSFORMS,
      scale: 20,
    };
    expect(clampHeadstockTransforms(transforms).scale).toBe(10);
  });
});

describe("headstockTransformsToNeckPatch", () => {
  it("maps position to headstock offset fields", () => {
    const transforms = {
      position: { x: 10, y: -5, z: 3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };
    const patch = headstockTransformsToNeckPatch(transforms);
    expect(patch.headstockOffsetXMm).toBe(10);
    expect(patch.headstockOffsetYMm).toBe(-5);
    expect(patch.headstockOffsetZMm).toBe(3);
  });

  it("maps scale to headstockScale", () => {
    const transforms = { ...DEFAULT_NODE_TRANSFORMS, scale: 1.5 };
    expect(headstockTransformsToNeckPatch(transforms).headstockScale).toBe(1.5);
  });
});
