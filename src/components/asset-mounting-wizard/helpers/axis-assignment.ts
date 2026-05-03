import type { Vec3 } from "@/lib/guitar/schema";

export type SignedAxis = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export function parseAxis(a: SignedAxis): Vec3 {
  const sign = a[0] === "+" ? 1 : -1;
  const axis = a[1];
  return {
    x: axis === "x" ? sign : 0,
    y: axis === "y" ? sign : 0,
    z: axis === "z" ? sign : 0,
  };
}

export function sameAxis(a: SignedAxis, b: SignedAxis): boolean {
  return a[1] === b[1];
}

function cross(u: Vec3, f: Vec3): Vec3 {
  return {
    x: u.y * f.z - u.z * f.y,
    y: u.z * f.x - u.x * f.z,
    z: u.x * f.y - u.y * f.x,
  };
}

function transpose(m: Matrix3): Matrix3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Extract Euler XYZ degrees from a rotation matrix whose layout matches
// buildRotationMatrix() in frame-transform.ts (intrinsic XYZ / extrinsic ZYX).
function extractEulerXYZ(R: Matrix3): Vec3 {
  const r20 = R[2][0];
  const r21 = R[2][1];
  const r22 = R[2][2];
  const r10 = R[1][0];
  const r00 = R[0][0];
  const r01 = R[0][1];
  const r02 = R[0][2];

  const cy = Math.sqrt(r21 * r21 + r22 * r22);
  const y = Math.atan2(-r20, cy);

  let x: number;
  let z: number;

  if (cy > 1e-6) {
    x = Math.atan2(r21, r22);
    z = Math.atan2(r10, r00);
  } else {
    // Gimbal lock (forward = ±x axis). Set z = 0 by convention.
    if (-r20 > 0) {
      // y ≈ +90°
      x = Math.atan2(r01, r02);
    } else {
      // y ≈ −90°
      x = Math.atan2(-r01, -r02);
    }
    z = 0;
  }

  return { x: toDeg(x), y: toDeg(y), z: toDeg(z) };
}

export function axisAssignmentToFrameRotation({
  canonicalForward,
  canonicalUp,
}: {
  canonicalForward: SignedAxis;
  canonicalUp: SignedAxis;
}): Vec3 {
  if (sameAxis(canonicalForward, canonicalUp)) {
    throw new Error("canonicalForward and canonicalUp share an axis");
  }

  const f = parseAxis(canonicalForward);
  const u = parseAxis(canonicalUp);
  const r = cross(u, f); // right = up × forward

  // B has r, u, f as columns; B^T = B^(-1) is the frame-rotation matrix
  const B: Matrix3 = [
    [r.x, u.x, f.x],
    [r.y, u.y, f.y],
    [r.z, u.z, f.z],
  ];

  return extractEulerXYZ(transpose(B));
}
