import * as THREE from "three";
import { INCH_TO_MM, type NeckParams } from "@/lib/neck-params";

const FRET_UNDERSIDE_OFFSET_MM = 0.02;
const FLAT_HEEL_RAMP_RATIO = 0.35;
const FLAT_HEEL_END_CORNER_RATIO = 0.2;

type PointGrid = THREE.Vector3[][];

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
  return 1.15;
}

function getVDepthMm(profile: NeckParams["profileType"]) {
  return profile === "V" ? 1.25 : 0;
}

function fretPositionMm(scaleMm: number, fret: number) {
  return scaleMm - scaleMm / Math.pow(2, fret / 12);
}

export function getNeckNutAnchorXmm(params: NeckParams) {
  const scaleMm = params.scaleLengthIn * INCH_TO_MM;
  const lastFretX = fretPositionMm(scaleMm, params.fretCount);
  return -lastFretX * 0.55;
}

function getPlayableWidthMm(params: NeckParams, lastFretX: number, x: number) {
  const fretT = clamp01(x / Math.max(lastFretX, 1e-6));
  return lerp(params.nutWidthMm, params.widthAtLastFretMm, fretT);
}

function getFingerboardRadiusMm(
  radiusStartMm: number,
  radiusEndMm: number,
  lastFretX: number,
  x: number,
) {
  const fretT = clamp01(x / Math.max(lastFretX, 1e-6));
  const radiusT = x <= lastFretX ? fretT : 1;
  return lerp(radiusStartMm, radiusEndMm, radiusT);
}

function getFretboardThicknessMm(
  params: NeckParams,
  boardEndX: number,
  x: number,
) {
  const t = clamp01(x / Math.max(boardEndX, 1e-6));
  return lerp(
    params.fretboardThicknessNutMm,
    params.fretboardThicknessEndMm,
    t,
  );
}

function getFretboardHalfWidthMm(
  params: NeckParams,
  lastFretX: number,
  x: number,
) {
  const playableWidth = getPlayableWidthMm(params, lastFretX, x);
  const boardWidth = Math.max(
    1,
    playableWidth - params.fretboardSideMarginMm * 2,
  );
  return boardWidth * 0.5;
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

function getFretboardTopZ(
  params: NeckParams,
  radiusStartMm: number,
  radiusEndMm: number,
  lastFretX: number,
  boardEndX: number,
  x: number,
  y: number,
) {
  const boardX = Math.max(0, Math.min(boardEndX, x));
  const halfW = getFretboardHalfWidthMm(params, lastFretX, boardX);
  const radius = getFingerboardRadiusMm(
    radiusStartMm,
    radiusEndMm,
    lastFretX,
    boardX,
  );
  return fingerboardCrownZ(y, halfW, radius);
}

function createPrismGeometry(topGrid: PointGrid, bottomGrid: PointGrid) {
  const geometry = new THREE.BufferGeometry();
  const xCount = topGrid.length;
  if (xCount === 0 || bottomGrid.length !== xCount) return geometry;

  const yCount = topGrid[0]?.length ?? 0;
  if (yCount === 0) return geometry;

  for (let ix = 0; ix < xCount; ix++) {
    if (
      topGrid[ix].length !== yCount ||
      bottomGrid[ix] == null ||
      bottomGrid[ix].length !== yCount
    ) {
      return geometry;
    }
  }

  const positions: number[] = [];

  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const pushQuad = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
  ) => {
    pushTri(a, b, c);
    pushTri(a, c, d);
  };

  for (let ix = 0; ix < xCount - 1; ix++) {
    for (let iy = 0; iy < yCount - 1; iy++) {
      const t00 = topGrid[ix][iy];
      const t10 = topGrid[ix + 1][iy];
      const t11 = topGrid[ix + 1][iy + 1];
      const t01 = topGrid[ix][iy + 1];

      const b00 = bottomGrid[ix][iy];
      const b10 = bottomGrid[ix + 1][iy];
      const b11 = bottomGrid[ix + 1][iy + 1];
      const b01 = bottomGrid[ix][iy + 1];

      pushQuad(t00, t10, t11, t01);
      pushQuad(b00, b01, b11, b10);
    }
  }

  for (let ix = 0; ix < xCount - 1; ix++) {
    pushQuad(
      topGrid[ix][0],
      topGrid[ix + 1][0],
      bottomGrid[ix + 1][0],
      bottomGrid[ix][0],
    );
  }
  for (let ix = 0; ix < xCount - 1; ix++) {
    pushQuad(
      topGrid[ix + 1][yCount - 1],
      topGrid[ix][yCount - 1],
      bottomGrid[ix][yCount - 1],
      bottomGrid[ix + 1][yCount - 1],
    );
  }
  for (let iy = 0; iy < yCount - 1; iy++) {
    pushQuad(
      topGrid[0][iy + 1],
      topGrid[0][iy],
      bottomGrid[0][iy],
      bottomGrid[0][iy + 1],
    );
  }
  for (let iy = 0; iy < yCount - 1; iy++) {
    pushQuad(
      topGrid[xCount - 1][iy],
      topGrid[xCount - 1][iy + 1],
      bottomGrid[xCount - 1][iy + 1],
      bottomGrid[xCount - 1][iy],
    );
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function buildNeckCoreMesh(
  params: NeckParams,
  firstFretX: number,
  twelfthFretX: number,
  lastFretX: number,
  neckLengthMm: number,
  boardEndX: number,
  preNutStubMm: number,
  radiusStartMm: number,
  radiusEndMm: number,
) {
  const tiltbackRad = THREE.MathUtils.degToRad(params.tiltbackAngleDeg);

  const meshStartX = -preNutStubMm;
  const meshLengthMm = neckLengthMm + preNutStubMm;

  const stations = 120;
  const ringSegments = 72;

  const positions: number[] = [];
  const indices: number[] = [];
  const rings: THREE.Vector3[][] = [];

  const backExponent = getProfileBackExponent(params.profileType);
  const vDepthMm = getVDepthMm(params.profileType);
  const heelStartX = lastFretX;
  const heelLengthMm = Math.max(1e-6, neckLengthMm - heelStartX);
  const flatHeelRampSpanMm = Math.max(
    1e-6,
    heelLengthMm * FLAT_HEEL_RAMP_RATIO,
  );
  const flatHeelCornerSpanMm = Math.max(
    1e-6,
    heelLengthMm * FLAT_HEEL_END_CORNER_RATIO,
  );
  const flatHeelCornerStartX = heelStartX + heelLengthMm - flatHeelCornerSpanMm;

  for (let i = 0; i < stations; i++) {
    const t = i / (stations - 1);
    const x = meshStartX + meshLengthMm * t;

    const widthAtFret = getPlayableWidthMm(params, lastFretX, x);

    let heelBlend = 0;
    if (x > heelStartX) {
      if (params.heelType === "flat") {
        if (x < heelStartX + flatHeelRampSpanMm) {
          heelBlend = smoothstep((x - heelStartX) / flatHeelRampSpanMm);
        } else {
          heelBlend = 1;
        }
      } else {
        heelBlend = smoothstep((x - heelStartX) / heelLengthMm);
      }
    }
    const width = lerp(widthAtFret, params.heelWidthMm, heelBlend);

    const thickT = clamp01(
      (x - firstFretX) / Math.max(twelfthFretX - firstFretX, 1e-6),
    );
    const thicknessAtFret = lerp(
      params.thicknessAt1stMm,
      params.thicknessAt12thMm,
      thickT,
    );
    const totalThickness = lerp(
      thicknessAtFret,
      params.heelThicknessMm,
      heelBlend,
    );

    const boardThicknessAtX =
      x >= 0 && x <= boardEndX
        ? getFretboardThicknessMm(params, boardEndX, x)
        : 0;
    const coreThickness = Math.max(1, totalThickness - boardThicknessAtX);
    const coreTopOffset = boardThicknessAtX;

    const halfW = width * 0.5;

    const fingerboardRadiusMm = getFingerboardRadiusMm(
      radiusStartMm,
      radiusEndMm,
      lastFretX,
      x,
    );

    const ring: THREE.Vector3[] = [];
    const topEdgeZ = -coreTopOffset;

    for (let j = 0; j < ringSegments; j++) {
      const p = (j / ringSegments) * 3;

      let y = 0;
      let z = 0;

      if (p < 1) {
        const s = p; // 0..1
        y = lerp(-halfW, halfW, s);
        z = fingerboardCrownZ(y, halfW, fingerboardRadiusMm) - coreTopOffset;
      } else if (p < 2) {
        const s = p - 1; // 0..1
        const theta = s * (Math.PI / 2); // 0..pi/2
        y = halfW * Math.cos(theta);
        z = topEdgeZ - coreThickness * Math.pow(Math.sin(theta), backExponent);
      } else {
        const s = p - 2; // 0..1
        const theta = s * (Math.PI / 2); // 0..pi/2
        y = -halfW * Math.sin(theta);
        z = topEdgeZ - coreThickness * Math.pow(Math.cos(theta), backExponent);
      }

      const backness = clamp01((topEdgeZ - z) / Math.max(coreThickness, 1e-6));

      // Optional V sharpening near back center
      if (vDepthMm > 0 && backness > 0.3) {
        const center = 1 - Math.min(1, Math.abs(y) / Math.max(halfW, 1e-6));
        z -= vDepthMm * Math.pow(center, 1.8);
      }

      // Slight asymmetric carve toward bass side on the back
      y += params.asymmetryMm * backness;

      // Heel corner softening toward heel end
      if (params.heelCornerRadiusMm > 0) {
        if (params.heelType === "sculpted" && heelBlend > 0.001) {
          const cornerT = smoothstep(heelBlend);
          const cornerScale = 1 - cornerT * (params.heelCornerRadiusMm / 40);
          y *= cornerScale;
        }
        if (params.heelType === "flat" && x > flatHeelCornerStartX) {
          const cornerT = smoothstep(
            (x - flatHeelCornerStartX) / flatHeelCornerSpanMm,
          );
          const cornerScale = 1 - cornerT * (params.heelCornerRadiusMm / 40);
          y *= cornerScale;
        }
      }

      let px = x;
      const py = y;
      let pz = z;

      if (px < 0 && Math.abs(tiltbackRad) > 1e-6) {
        const tiltT = smoothstep(clamp01(-px / preNutStubMm));
        const theta = tiltbackRad * tiltT;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rx = px * cos - pz * sin;
        const rz = px * sin + pz * cos;
        px = rx;
        pz = rz;
      }

      ring.push(new THREE.Vector3(px, py, pz));
    }

    rings.push(ring);
  }

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

  // Cap start (headstock-side end)
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

  const mat = new THREE.MeshStandardMaterial({
    color: "#c48b5b",
    roughness: 0.62,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = "neck-core";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildFretboardMesh(
  params: NeckParams,
  lastFretX: number,
  boardEndX: number,
  radiusStartMm: number,
  radiusEndMm: number,
) {
  const xSegments = 96;
  const ySegments = 60;
  const topGrid: PointGrid = [];
  const bottomGrid: PointGrid = [];

  for (let ix = 0; ix <= xSegments; ix++) {
    const x = lerp(0, boardEndX, ix / xSegments);
    const halfW = getFretboardHalfWidthMm(params, lastFretX, x);
    const thickness = getFretboardThicknessMm(params, boardEndX, x);
    const radius = getFingerboardRadiusMm(
      radiusStartMm,
      radiusEndMm,
      lastFretX,
      x,
    );

    const topColumn: THREE.Vector3[] = [];
    const bottomColumn: THREE.Vector3[] = [];
    for (let iy = 0; iy <= ySegments; iy++) {
      const y = lerp(-halfW, halfW, iy / ySegments);
      const topZ = fingerboardCrownZ(y, halfW, radius);
      topColumn.push(new THREE.Vector3(x, y, topZ));
      bottomColumn.push(new THREE.Vector3(x, y, topZ - thickness));
    }
    topGrid.push(topColumn);
    bottomGrid.push(bottomColumn);
  }

  const geometry = createPrismGeometry(topGrid, bottomGrid);
  const mat = new THREE.MeshStandardMaterial({
    color: "#5a3c2a",
    roughness: 0.68,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = "fretboard";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildNutMesh(
  params: NeckParams,
  lastFretX: number,
  boardEndX: number,
  radiusStartMm: number,
  radiusEndMm: number,
) {
  const xSegments = 16;
  const ySegments = 72;
  const halfW = getFretboardHalfWidthMm(params, lastFretX, 0);
  const topGrid: PointGrid = [];
  const bottomGrid: PointGrid = [];

  const usableHalf = Math.max(0, halfW - params.nutEdgeMarginMm);
  const slotCenters: number[] = [];
  if (params.stringCount <= 1 || usableHalf <= 1e-6) {
    slotCenters.push(0);
  } else {
    const step = (usableHalf * 2) / (params.stringCount - 1);
    for (let i = 0; i < params.stringCount; i++) {
      slotCenters.push(-usableHalf + step * i);
    }
  }

  const slotHalfWidth = params.nutSlotWidthMm * 0.5;

  for (let ix = 0; ix <= xSegments; ix++) {
    const x = lerp(-params.nutThicknessMm, 0, ix / xSegments);
    const topColumn: THREE.Vector3[] = [];
    const bottomColumn: THREE.Vector3[] = [];

    for (let iy = 0; iy <= ySegments; iy++) {
      const y = lerp(-halfW, halfW, iy / ySegments);
      const boardTopZ = getFretboardTopZ(
        params,
        radiusStartMm,
        radiusEndMm,
        lastFretX,
        boardEndX,
        0,
        y,
      );

      let slotInfluence = 0;
      if (slotHalfWidth > 1e-6) {
        for (const center of slotCenters) {
          const influence = clamp01(1 - Math.abs(y - center) / slotHalfWidth);
          slotInfluence = Math.max(slotInfluence, influence);
        }
      }

      const slotDepth = slotInfluence * params.nutSlotDepthMm;
      const topZ = Math.max(
        boardTopZ + 0.1,
        boardTopZ + params.nutHeightMm - slotDepth,
      );

      topColumn.push(new THREE.Vector3(x, y, topZ));
      bottomColumn.push(new THREE.Vector3(x, y, boardTopZ));
    }

    topGrid.push(topColumn);
    bottomGrid.push(bottomColumn);
  }

  const geometry = createPrismGeometry(topGrid, bottomGrid);
  const mat = new THREE.MeshStandardMaterial({
    color: "#ece1c8",
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = "nut";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildFretsGroup(
  params: NeckParams,
  scaleMm: number,
  lastFretX: number,
  boardEndX: number,
  radiusStartMm: number,
  radiusEndMm: number,
) {
  const group = new THREE.Group();
  group.name = "frets";

  const fretMat = new THREE.MeshStandardMaterial({
    color: "#c7c9cc",
    roughness: 0.28,
    metalness: 0.85,
    side: THREE.DoubleSide,
  });

  const xSegments = 12;
  const ySegments = 24;
  const crownHalfWidth = Math.max(0.05, params.fretCrownWidthMm * 0.5);

  for (let fret = 1; fret <= params.fretCount; fret++) {
    const fretX = fretPositionMm(scaleMm, fret);
    const boardHalfW = getFretboardHalfWidthMm(params, lastFretX, fretX);
    const halfLength = boardHalfW - params.fretEndInsetMm;
    if (halfLength <= 0.1) continue;

    const topGrid: PointGrid = [];
    const bottomGrid: PointGrid = [];

    for (let ix = 0; ix <= xSegments; ix++) {
      const localX = lerp(-crownHalfWidth, crownHalfWidth, ix / xSegments);
      const worldX = fretX + localX;
      const normalized = Math.abs(localX) / crownHalfWidth;
      const crownHeight =
        params.fretCrownHeightMm * (1 - normalized * normalized);

      const topColumn: THREE.Vector3[] = [];
      const bottomColumn: THREE.Vector3[] = [];
      for (let iy = 0; iy <= ySegments; iy++) {
        const y = lerp(-halfLength, halfLength, iy / ySegments);
        const boardTopZ = getFretboardTopZ(
          params,
          radiusStartMm,
          radiusEndMm,
          lastFretX,
          boardEndX,
          worldX,
          y,
        );
        topColumn.push(new THREE.Vector3(worldX, y, boardTopZ + crownHeight));
        bottomColumn.push(
          new THREE.Vector3(worldX, y, boardTopZ - FRET_UNDERSIDE_OFFSET_MM),
        );
      }

      topGrid.push(topColumn);
      bottomGrid.push(bottomColumn);
    }

    const geometry = createPrismGeometry(topGrid, bottomGrid);
    const mesh = new THREE.Mesh(geometry, fretMat);
    mesh.name = `fret-${fret}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

export function buildProceduralNeckMesh(params: NeckParams) {
  const preNutStubMm = Math.max(4, params.nutThicknessMm + 1.5);
  const scaleMm = params.scaleLengthIn * INCH_TO_MM;
  const firstFretX = fretPositionMm(scaleMm, 1);
  const twelfthFretX = fretPositionMm(scaleMm, 12);
  const lastFretX = fretPositionMm(scaleMm, params.fretCount);
  const neckEndX = lastFretX + Math.max(0, params.heelLengthMm);
  const neckLengthMm = Math.max(1, neckEndX);
  const boardEndX = neckEndX + Math.max(0, params.fretboardOverhangMm);
  const radiusStartMm = params.fingerboardRadiusStartIn * INCH_TO_MM;
  const radiusEndMm = params.fingerboardRadiusEndIn * INCH_TO_MM;

  const group = new THREE.Group();
  group.name = "procedural-neck";

  const neckCore = buildNeckCoreMesh(
    params,
    firstFretX,
    twelfthFretX,
    lastFretX,
    neckLengthMm,
    boardEndX,
    preNutStubMm,
    radiusStartMm,
    radiusEndMm,
  );
  const fretboard = buildFretboardMesh(
    params,
    lastFretX,
    boardEndX,
    radiusStartMm,
    radiusEndMm,
  );
  const nut = buildNutMesh(
    params,
    lastFretX,
    boardEndX,
    radiusStartMm,
    radiusEndMm,
  );
  const frets = buildFretsGroup(
    params,
    scaleMm,
    lastFretX,
    boardEndX,
    radiusStartMm,
    radiusEndMm,
  );

  group.add(neckCore);
  group.add(fretboard);
  group.add(nut);
  group.add(frets);

  group.position.x = getNeckNutAnchorXmm(params);

  return group;
}
