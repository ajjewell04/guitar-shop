import { describe, it, expect } from "vitest";
import {
  Vec3Schema,
  BodyGuitarMetaSchema,
  BridgeGuitarMetaSchema,
  PickupGuitarMetaSchema,
  GuitarMetaSchema,
} from "@/lib/guitar/schema";

const vec3 = { x: 0, y: 0, z: 0 };

describe("Vec3Schema", () => {
  it("accepts all-zero object", () => {
    expect(() => Vec3Schema.parse(vec3)).not.toThrow();
  });

  it("accepts negative and floating-point values", () => {
    expect(() => Vec3Schema.parse({ x: -3.5, y: 1.2, z: 0 })).not.toThrow();
  });

  it("rejects a missing axis", () => {
    expect(() => Vec3Schema.parse({ x: 1, y: 2 })).toThrow();
  });

  it("rejects a non-numeric axis", () => {
    expect(() => Vec3Schema.parse({ x: "0", y: 0, z: 0 })).toThrow();
  });
});

describe("BodyGuitarMetaSchema", () => {
  const valid = {
    kind: "body",
    frameRotation: vec3,
    neckPocket: { origin: vec3, rotation: vec3 },
  };

  it("accepts a valid body payload", () => {
    expect(() => BodyGuitarMetaSchema.parse(valid)).not.toThrow();
  });

  it("rejects a missing neckPocket", () => {
    const { neckPocket: _omit, ...rest } = valid;
    expect(() => BodyGuitarMetaSchema.parse(rest)).toThrow();
  });

  it("rejects missing neckPocket.origin", () => {
    expect(() =>
      BodyGuitarMetaSchema.parse({
        ...valid,
        neckPocket: { rotation: vec3 },
      }),
    ).toThrow();
  });

  it("rejects wrong kind", () => {
    expect(() =>
      BodyGuitarMetaSchema.parse({ ...valid, kind: "bridge" }),
    ).toThrow();
  });
});

describe("BridgeGuitarMetaSchema", () => {
  const valid = {
    kind: "bridge",
    frameRotation: vec3,
    saddleLine: { bassEnd: vec3, trebleEnd: vec3 },
  };

  it("accepts a valid bridge payload", () => {
    expect(() => BridgeGuitarMetaSchema.parse(valid)).not.toThrow();
  });

  it("rejects missing saddleLine", () => {
    const { saddleLine: _omit, ...rest } = valid;
    expect(() => BridgeGuitarMetaSchema.parse(rest)).toThrow();
  });

  it("rejects missing saddleLine.trebleEnd", () => {
    expect(() =>
      BridgeGuitarMetaSchema.parse({
        ...valid,
        saddleLine: { bassEnd: vec3 },
      }),
    ).toThrow();
  });
});

describe("PickupGuitarMetaSchema", () => {
  const valid = {
    kind: "pickup",
    frameRotation: vec3,
    magneticCenter: vec3,
  };

  it("accepts a valid pickup payload", () => {
    expect(() => PickupGuitarMetaSchema.parse(valid)).not.toThrow();
  });

  it("rejects missing magneticCenter", () => {
    const { magneticCenter: _omit, ...rest } = valid;
    expect(() => PickupGuitarMetaSchema.parse(rest)).toThrow();
  });
});

describe("GuitarMetaSchema (discriminated union)", () => {
  it("routes to body variant", () => {
    const result = GuitarMetaSchema.parse({
      kind: "body",
      frameRotation: vec3,
      neckPocket: { origin: vec3, rotation: vec3 },
    });
    expect(result.kind).toBe("body");
  });

  it("routes to bridge variant", () => {
    const result = GuitarMetaSchema.parse({
      kind: "bridge",
      frameRotation: vec3,
      saddleLine: { bassEnd: vec3, trebleEnd: vec3 },
    });
    expect(result.kind).toBe("bridge");
  });

  it("routes to pickup variant", () => {
    const result = GuitarMetaSchema.parse({
      kind: "pickup",
      frameRotation: vec3,
      magneticCenter: vec3,
    });
    expect(result.kind).toBe("pickup");
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      GuitarMetaSchema.parse({ kind: "neck", frameRotation: vec3 }),
    ).toThrow();
  });

  it("rejects missing kind", () => {
    expect(() => GuitarMetaSchema.parse({ frameRotation: vec3 })).toThrow();
  });
});
