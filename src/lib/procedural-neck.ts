import * as THREE from "three";
import { INCH_TO_MM, type NeckParams } from "@/lib/neck-params";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function getProfileBackExponent(profile: NeckParams["profileType"]) {
  if (profile === "C") return 1.35;
  if (profile === "U") return 1.0;
  if (profile === "V") return 1.7;
  return 1.15; // D
}

function getVDepthMm(profile: NeckParams["profileType"]) {
  return profile === "V" ? 1.25 : 0;
}

function fretPositionMm(scaleMm: number, fret: number) {
  return scaleMm - scaleMm / Math.pow(2, fret / 12);
}

function ringCentroid(ring: THREE.Vector3[]) {
  const c = new THREE.Vector3();
  for (const p of ring) c.add(p);
  c.multiplyScalar(1 / Math.max(1, ring.length));
  return c;
}

function fingerboardCrownZ(y: number, halfW: number, radiusMm: number) {
  if (radiusMm <= halfW) return 0;
  const yClamped = Math.max(-halfW, Math.min(halfW, y));
  const edge = Math.sqrt(radiusMm * radiusMm - halfW * halfW);
  const point = Math.sqrt(radiusMm * radiusMm - yClamped * yClamped);
  return point - edge;
}

export function buildProceduralNeckMesh(params: NeckParams) {
  const scaleMm = params.scaleLengthIn * INCH_TO_MM;
  const firstFretX = fretPositionMm(scaleMm, 1);
  const twelfthFretX = fretPositionMm(scaleMm, 12);
  const lastFretX = fretPositionMm(scaleMm, params.fretCount);
  const neckLengthMm = lastFretX + params.heelLengthMm;
  const radiusStartMm = params.fingerboardRadiusStartIn * INCH_TO_MM;
  const radiusEndMm = params.fingerboardRadiusEndIn * INCH_TO_MM;

  const stations = 120;
  const ringSegments = 72;

  const positions: number[] = [];
  const indices: number[] = [];
  const rings: THREE.Vector3[][] = [];

  const backExponent = getProfileBackExponent(params.profileType);
  const vDepthMm = getVDepthMm(params.profileType);

  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1);
    const x = neckLengthMm * t;

    const wT = x <= lastFretX ? x / Math.max(lastFretX, 1e-6) : 1;
    const widthAtFret = lerp(
      params.nutWidthMm,
      params.widthAtLastFretMm,
      clamp01(wT),
    );

    const heelBlend =
      x <= lastFretX ? 0 : smoothstep((x - lastFretX) / params.heelLengthMm);
    const width = lerp(widthAtFret, params.heelWidthMm, heelBlend);

    const thickT = clamp01(
      (x - firstFretX) / Math.max(twelfthFretX - firstFretX, 1e-6),
    );
    const thicknessAtFret = lerp(
      params.thicknessAt1stMm,
      params.thicknessAt12thMm,
      thickT,
    );
    const thickness = lerp(thicknessAtFret, params.heelThicknessMm, heelBlend);

    const halfW = width * 0.5;
    const backDepth = Math.max(1, thickness);

    const fretT = clamp01(x / Math.max(lastFretX, 1e-6));
    const radiusT = x <= lastFretX ? fretT : 1;
    const fingerboardRadiusMm = lerp(radiusStartMm, radiusEndMm, radiusT);

    const ring: THREE.Vector3[] = [];

    for (let j = 0; j < ringSegments; j++) {
      const p = (j / ringSegments) * 3;

      let y = 0;
      let z = 0;

      if (p < 1) {
        const s = p; // 0..1
        y = lerp(-halfW, halfW, s);
        z = fingerboardCrownZ(y, halfW, fingerboardRadiusMm);
      } else if (p < 2) {
        const s = p - 1; // 0..1
        const theta = s * (Math.PI / 2); // 0..pi/2
        y = halfW * Math.cos(theta);
        z = -backDepth * Math.pow(Math.sin(theta), backExponent);
      } else {
        const s = p - 2; // 0..1
        const theta = s * (Math.PI / 2); // 0..pi/2
        y = -halfW * Math.sin(theta);
        z = -backDepth * Math.pow(Math.cos(theta), backExponent);
      }

      // Optional V sharpening near back center
      if (vDepthMm > 0 && z < -backDepth * 0.3) {
        const center = 1 - Math.min(1, Math.abs(y) / Math.max(halfW, 1e-6));
        z -= vDepthMm * Math.pow(center, 1.8);
      }

      // Slight asymmetric carve toward bass side on the back
      const backness = clamp01(-z / Math.max(backDepth, 1e-6));
      y += params.asymmetryMm * backness;

      // Heel corner softening toward heel end
      if (heelBlend > 0.001 && params.heelCornerRadiusMm > 0) {
        const cornerT = smoothstep(heelBlend);
        const cornerScale = 1 - cornerT * (params.heelCornerRadiusMm / 40);
        y *= cornerScale;
      }

      ring.push(new THREE.Vector3(x, y, z));
    }

    rings.push(ring);
  }

  // Flatten rings to vertex list
  for (let i = 0; i < stations; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const p = rings[i][j];
      positions.push(p.x, p.y, p.z);
    }
  }

  // Side surface
  for (let i = 0; i < stations - 1; i++) {
    for (let j = 0; j < ringSegments; j++) {
      const jn = (j + 1) % ringSegments;
      const a = i * ringSegments + j;
      const b = i * ringSegments + jn;
      const c = (i + 1) * ringSegments + j;
      const d = (i + 1) * ringSegments + jn;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Cap start (nut end)
  const startCenter = ringCentroid(rings[0]);
  const startCenterIndex = positions.length / 3;
  positions.push(startCenter.x, startCenter.y, startCenter.z);

  for (let j = 0; j < ringSegments; j++) {
    const jn = (j + 1) % ringSegments;
    const a = j;
    const b = jn;
    indices.push(startCenterIndex, b, a);
  }

  // Cap end (heel end)
  const base = (stations - 1) * ringSegments;
  const endCenter = ringCentroid(rings[stations - 1]);
  const endCenterIndex = positions.length / 3;
  positions.push(endCenter.x, endCenter.y, endCenter.z);

  for (let j = 0; j < ringSegments; j++) {
    const jn = (j + 1) % ringSegments;
    const a = base + j;
    const b = base + jn;
    indices.push(endCenterIndex, a, b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Place around playable region
  geometry.translate(-lastFretX * 0.55, 0, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: "#c48b5b",
    roughness: 0.62,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.y = THREE.MathUtils.degToRad(params.neckAngleDeg);

  return mesh;
}
