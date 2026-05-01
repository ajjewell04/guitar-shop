import { describe, it, expect } from "vitest";
import {
  applyFrameTransform,
  invertFrameTransform,
} from "@/lib/guitar/frame-transform";

const EPS = 1e-10;

function expectVec3Close(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(EPS);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(EPS);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(EPS);
}

describe("applyFrameTransform", () => {
  it("returns the point unchanged for zero rotation", () => {
    const p = { x: 10, y: 20, z: 30 };
    expectVec3Close(applyFrameTransform(p, { x: 0, y: 0, z: 0 }), p);
  });

  it("rotates +X to +Y with 90° Z rotation", () => {
    expectVec3Close(
      applyFrameTransform({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 90 }),
      { x: 0, y: 1, z: 0 },
    );
  });

  it("rotates +Z to +X with 90° Y rotation", () => {
    expectVec3Close(
      applyFrameTransform({ x: 0, y: 0, z: 1 }, { x: 0, y: 90, z: 0 }),
      { x: 1, y: 0, z: 0 },
    );
  });

  it("rotates +Y to +Z with 90° X rotation", () => {
    expectVec3Close(
      applyFrameTransform({ x: 0, y: 1, z: 0 }, { x: 90, y: 0, z: 0 }),
      { x: 0, y: 0, z: 1 },
    );
  });

  it("preserves vector length under compound rotation", () => {
    const result = applyFrameTransform(
      { x: 1, y: 0, z: 0 },
      { x: 30, y: 45, z: 60 },
    );
    const len = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);
    expect(Math.abs(len - 1)).toBeLessThan(EPS);
  });
});

describe("invertFrameTransform", () => {
  it("returns the point unchanged for zero rotation", () => {
    const p = { x: 7, y: 8, z: 9 };
    expectVec3Close(invertFrameTransform(p, { x: 0, y: 0, z: 0 }), p);
  });

  it("round-trips back to original (arbitrary point and rotation)", () => {
    const original = { x: 5, y: -3, z: 12 };
    const rotation = { x: 15, y: -30, z: 45 };
    const forward = applyFrameTransform(original, rotation);
    expectVec3Close(invertFrameTransform(forward, rotation), original);
  });

  it("round-trips a typical neck-angle rotation", () => {
    const original = { x: 0, y: 0, z: 100 };
    const rotation = { x: 5, y: 0, z: 0 };
    const forward = applyFrameTransform(original, rotation);
    expectVec3Close(invertFrameTransform(forward, rotation), original);
  });
});
