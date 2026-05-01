import type { Vec3 } from "@/lib/guitar/schema";

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function buildRotationMatrix(
  r: Vec3,
): [number, number, number, number, number, number, number, number, number] {
  const cx = Math.cos(toRad(r.x)),
    sx = Math.sin(toRad(r.x));
  const cy = Math.cos(toRad(r.y)),
    sy = Math.sin(toRad(r.y));
  const cz = Math.cos(toRad(r.z)),
    sz = Math.sin(toRad(r.z));
  return [
    cy * cz,
    cz * sx * sy - cx * sz,
    cx * cz * sy + sx * sz,
    cy * sz,
    cx * cz + sx * sy * sz,
    cx * sy * sz - cz * sx,
    -sy,
    cy * sx,
    cx * cy,
  ];
}

/** Rotate a point from the asset's native frame into the canonical guitar frame. */
export function applyFrameTransform(point: Vec3, rotation: Vec3): Vec3 {
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] =
    buildRotationMatrix(rotation);
  return {
    x: r00 * point.x + r01 * point.y + r02 * point.z,
    y: r10 * point.x + r11 * point.y + r12 * point.z,
    z: r20 * point.x + r21 * point.y + r22 * point.z,
  };
}

/** Rotate a point from the canonical guitar frame back into the asset's native frame. */
export function invertFrameTransform(point: Vec3, rotation: Vec3): Vec3 {
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] =
    buildRotationMatrix(rotation);
  // R is orthogonal, so R⁻¹ = Rᵀ — swap row/col indices
  return {
    x: r00 * point.x + r10 * point.y + r20 * point.z,
    y: r01 * point.x + r11 * point.y + r21 * point.z,
    z: r02 * point.x + r12 * point.y + r22 * point.z,
  };
}
