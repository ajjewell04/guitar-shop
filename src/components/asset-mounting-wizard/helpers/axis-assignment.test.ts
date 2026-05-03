import { describe, it, expect } from "vitest";
import {
  axisAssignmentToFrameRotation,
  parseAxis,
  type SignedAxis,
} from "./axis-assignment";
import { applyFrameTransform } from "@/lib/guitar/frame-transform";
import type { Vec3 } from "@/lib/guitar/schema";

function approxEq(a: Vec3, b: Vec3, eps = 1e-6): boolean {
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.z - b.z) < eps
  );
}

function verifyAssignment(forward: SignedAxis, up: SignedAxis) {
  const rotation = axisAssignmentToFrameRotation({
    canonicalForward: forward,
    canonicalUp: up,
  });
  const fVec = parseAxis(forward);
  const uVec = parseAxis(up);
  const canonicalForward = applyFrameTransform(fVec, rotation);
  const canonicalUp = applyFrameTransform(uVec, rotation);
  expect(approxEq(canonicalForward, { x: 0, y: 0, z: 1 })).toBe(true);
  expect(approxEq(canonicalUp, { x: 0, y: 1, z: 0 })).toBe(true);
}

describe("axisAssignmentToFrameRotation", () => {
  it("identity: forward=+z up=+y", () => verifyAssignment("+z", "+y"));
  it("forward=+x up=+y", () => verifyAssignment("+x", "+y"));
  it("forward=-x up=+y", () => verifyAssignment("-x", "+y"));
  it("forward=-z up=+y", () => verifyAssignment("-z", "+y"));
  it("forward=+y up=+z", () => verifyAssignment("+y", "+z"));
  it("forward=-y up=+z", () => verifyAssignment("-y", "+z"));
  it("forward=+z up=-x", () => verifyAssignment("+z", "-x"));
  it("forward=+x up=-z", () => verifyAssignment("+x", "-z"));
  it("forward=-z up=-y", () => verifyAssignment("-z", "-y"));

  it("throws when forward and up share an axis (same sign)", () => {
    expect(() =>
      axisAssignmentToFrameRotation({
        canonicalForward: "+x",
        canonicalUp: "+x",
      }),
    ).toThrow("share an axis");
  });

  it("throws when forward and up share an axis (opposite sign)", () => {
    expect(() =>
      axisAssignmentToFrameRotation({
        canonicalForward: "+x",
        canonicalUp: "-x",
      }),
    ).toThrow("share an axis");
  });

  it("throws for +y / -y conflict", () => {
    expect(() =>
      axisAssignmentToFrameRotation({
        canonicalForward: "+y",
        canonicalUp: "-y",
      }),
    ).toThrow("share an axis");
  });
});
