import { describe, it, expect } from "vitest";
import {
  normalizeNodeTransforms,
  nodeTransformsToMatrix,
  nodeTransformsFromMatrix,
  buildWorldMatrixByNodeId,
  buildWorldTransformsByNodeId,
  DEFAULT_NODE_TRANSFORMS,
} from "@/lib/node-hierarchy";

describe("normalizeNodeTransforms", () => {
  it("returns defaults when called with null", () => {
    expect(normalizeNodeTransforms(null)).toEqual(DEFAULT_NODE_TRANSFORMS);
  });

  it("returns defaults when called with undefined", () => {
    expect(normalizeNodeTransforms(undefined)).toEqual(DEFAULT_NODE_TRANSFORMS);
  });

  it("preserves valid finite numbers", () => {
    const input = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 45, y: 90, z: 0 },
      scale: 2,
    };
    const result = normalizeNodeTransforms(input);
    expect(result.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(result.rotation).toEqual({ x: 45, y: 90, z: 0 });
    expect(result.scale).toBe(2);
  });

  it("replaces NaN with the default value", () => {
    const result = normalizeNodeTransforms({
      position: { x: NaN, y: 0, z: 0 },
      scale: NaN,
    });
    expect(result.position.x).toBe(DEFAULT_NODE_TRANSFORMS.position.x);
    expect(result.scale).toBe(DEFAULT_NODE_TRANSFORMS.scale);
  });

  it("replaces Infinity with the default value", () => {
    const result = normalizeNodeTransforms({
      position: { x: Infinity, y: 0, z: 0 },
    });
    expect(result.position.x).toBe(DEFAULT_NODE_TRANSFORMS.position.x);
  });
});

describe("nodeTransformsToMatrix / nodeTransformsFromMatrix", () => {
  it("round-trips position", () => {
    const transforms = {
      position: { x: 1.5, y: -2.5, z: 10 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    };
    const result = nodeTransformsFromMatrix(nodeTransformsToMatrix(transforms));
    expect(result.position.x).toBeCloseTo(1.5);
    expect(result.position.y).toBeCloseTo(-2.5);
    expect(result.position.z).toBeCloseTo(10);
  });

  it("round-trips single-axis rotation", () => {
    const transforms = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 45, y: 0, z: 0 },
      scale: 1,
    };
    const result = nodeTransformsFromMatrix(nodeTransformsToMatrix(transforms));
    expect(result.rotation.x).toBeCloseTo(45);
    expect(result.rotation.y).toBeCloseTo(0);
    expect(result.rotation.z).toBeCloseTo(0);
  });

  it("round-trips scale", () => {
    const transforms = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 2.5,
    };
    const result = nodeTransformsFromMatrix(nodeTransformsToMatrix(transforms));
    expect(result.scale).toBeCloseTo(2.5);
  });
});

describe("buildWorldMatrixByNodeId", () => {
  it("returns an empty map for an empty node list", () => {
    expect(buildWorldMatrixByNodeId([]).size).toBe(0);
  });

  it("returns an identity-equivalent matrix for a root node with default transforms", () => {
    const nodes = [{ id: "root", parent_id: null, transforms: null }];
    const matrices = buildWorldMatrixByNodeId(nodes);
    const transforms = nodeTransformsFromMatrix(matrices.get("root")!);
    expect(transforms.position.x).toBeCloseTo(0);
    expect(transforms.position.y).toBeCloseTo(0);
    expect(transforms.position.z).toBeCloseTo(0);
    expect(transforms.scale).toBeCloseTo(1);
  });

  it("accumulates parent translation into child world position", () => {
    const nodes = [
      {
        id: "parent",
        parent_id: null,
        transforms: {
          position: { x: 10, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
      },
      {
        id: "child",
        parent_id: "parent",
        transforms: {
          position: { x: 5, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
      },
    ];
    const matrices = buildWorldMatrixByNodeId(nodes);
    const childWorld = nodeTransformsFromMatrix(matrices.get("child")!);
    expect(childWorld.position.x).toBeCloseTo(15);
  });

  it("handles a cycle without throwing and returns a map entry for each node", () => {
    const nodes = [
      { id: "a", parent_id: "b", transforms: null },
      { id: "b", parent_id: "a", transforms: null },
    ];
    expect(() => buildWorldMatrixByNodeId(nodes)).not.toThrow();
    expect(buildWorldMatrixByNodeId(nodes).size).toBe(2);
  });

  it("returns an identity-equivalent matrix when parent_id references a missing node", () => {
    const nodes = [{ id: "child", parent_id: "nonexistent", transforms: null }];
    const matrices = buildWorldMatrixByNodeId(nodes);
    expect(matrices.size).toBe(1);
    const t = nodeTransformsFromMatrix(matrices.get("child")!);
    expect(t.position.x).toBeCloseTo(0);
    expect(t.scale).toBeCloseTo(1);
  });
});

describe("buildWorldTransformsByNodeId", () => {
  it("returns decomposed world transforms for each node", () => {
    const nodes = [{ id: "root", parent_id: null, transforms: null }];
    const result = buildWorldTransformsByNodeId(nodes);
    expect(result.has("root")).toBe(true);
    expect(result.get("root")!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("child position is offset from parent in world space", () => {
    const nodes = [
      {
        id: "parent",
        parent_id: null,
        transforms: {
          position: { x: 0, y: 5, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
      },
      {
        id: "child",
        parent_id: "parent",
        transforms: {
          position: { x: 0, y: 3, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: 1,
        },
      },
    ];
    const result = buildWorldTransformsByNodeId(nodes);
    expect(result.get("child")!.position.y).toBeCloseTo(8);
  });
});
