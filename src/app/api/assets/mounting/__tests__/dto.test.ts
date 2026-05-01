import { describe, it, expect } from "vitest";
import { SaveMountingBodySchema } from "../dto";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const vec3 = { x: 0, y: 0, z: 0 };

describe("SaveMountingBodySchema", () => {
  it("accepts a valid body payload", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: {
          kind: "body",
          frameRotation: vec3,
          neckPocket: { origin: vec3, rotation: vec3 },
        },
      }),
    ).not.toThrow();
  });

  it("accepts a valid bridge payload", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: {
          kind: "bridge",
          frameRotation: vec3,
          saddleLine: { bassEnd: vec3, trebleEnd: vec3 },
        },
      }),
    ).not.toThrow();
  });

  it("accepts a valid pickup payload", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: {
          kind: "pickup",
          frameRotation: vec3,
          magneticCenter: vec3,
        },
      }),
    ).not.toThrow();
  });

  it("rejects a non-UUID assetId", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: "not-a-uuid",
        guitar: { kind: "pickup", frameRotation: vec3, magneticCenter: vec3 },
      }),
    ).toThrow();
  });

  it("rejects a missing assetId", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        guitar: { kind: "pickup", frameRotation: vec3, magneticCenter: vec3 },
      }),
    ).toThrow();
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: { kind: "neck", frameRotation: vec3 },
      }),
    ).toThrow();
  });

  it("rejects body payload missing neckPocket", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: { kind: "body", frameRotation: vec3 },
      }),
    ).toThrow();
  });

  it("rejects bridge payload missing saddleLine", () => {
    expect(() =>
      SaveMountingBodySchema.parse({
        assetId: UUID,
        guitar: { kind: "bridge", frameRotation: vec3 },
      }),
    ).toThrow();
  });
});
