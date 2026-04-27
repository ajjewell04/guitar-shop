import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { getNeckNutAnchorXmm, buildProceduralNeckMesh } from "@/lib/neck/mesh";
import { DEFAULT_NECK_PARAMS } from "@/lib/neck/params";

describe("getNeckNutAnchorXmm", () => {
  it("returns a finite negative number for default params", () => {
    const x = getNeckNutAnchorXmm(DEFAULT_NECK_PARAMS);
    expect(Number.isFinite(x)).toBe(true);
    expect(x).toBeLessThan(0);
  });

  it("returns a more negative value when scale length increases", () => {
    const short = getNeckNutAnchorXmm({
      ...DEFAULT_NECK_PARAMS,
      scaleLengthIn: 24.75,
    });
    const long = getNeckNutAnchorXmm({
      ...DEFAULT_NECK_PARAMS,
      scaleLengthIn: 25.5,
    });
    expect(long).toBeLessThan(short);
  });
});

describe("buildProceduralNeckMesh", () => {
  it("returns a THREE.Group", () => {
    const group = buildProceduralNeckMesh(DEFAULT_NECK_PARAMS);
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("names the group 'procedural-neck'", () => {
    const group = buildProceduralNeckMesh(DEFAULT_NECK_PARAMS);
    expect(group.name).toBe("procedural-neck");
  });

  it("has exactly 4 direct children: neck core, fretboard, nut, and frets group", () => {
    const group = buildProceduralNeckMesh(DEFAULT_NECK_PARAMS);
    expect(group.children).toHaveLength(4);
  });

  it("frets group child count matches fretCount param", () => {
    const group = buildProceduralNeckMesh(DEFAULT_NECK_PARAMS);
    const fretsGroup = group.children[3]!;
    expect(fretsGroup.children).toHaveLength(DEFAULT_NECK_PARAMS.fretCount);
  });

  it("sets group.position.x to the nut anchor value", () => {
    const group = buildProceduralNeckMesh(DEFAULT_NECK_PARAMS);
    expect(group.position.x).toBeCloseTo(
      getNeckNutAnchorXmm(DEFAULT_NECK_PARAMS),
    );
  });

  it("builds without throwing when tiltbackAngleDeg is non-zero", () => {
    const params = { ...DEFAULT_NECK_PARAMS, tiltbackAngleDeg: 10 };
    const group = buildProceduralNeckMesh(params);
    expect(group.children).toHaveLength(4);
  });

  it("builds without throwing when heelType is sculpted", () => {
    const params = { ...DEFAULT_NECK_PARAMS, heelType: "sculpted" as const };
    const group = buildProceduralNeckMesh(params);
    expect(group.children).toHaveLength(4);
  });
});
