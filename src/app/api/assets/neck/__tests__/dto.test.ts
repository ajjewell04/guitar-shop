import { describe, it, expect } from "vitest";
import {
  CreateNeckBodySchema,
  NeckPresignBodySchema,
  SaveNeckBodySchema,
} from "../dto";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("CreateNeckBodySchema", () => {
  it("accepts an empty object (name is optional)", () => {
    expect(() => CreateNeckBodySchema.parse({})).not.toThrow();
  });

  it("accepts a valid name string", () => {
    expect(() => CreateNeckBodySchema.parse({ name: "My Neck" })).not.toThrow();
  });

  it("rejects an empty name string", () => {
    expect(() => CreateNeckBodySchema.parse({ name: "" })).toThrow();
  });

  it("rejects a whitespace-only name after trimming", () => {
    expect(() => CreateNeckBodySchema.parse({ name: "   " })).toThrow();
  });
});

describe("NeckPresignBodySchema", () => {
  it("accepts a valid UUID assetId", () => {
    expect(() => NeckPresignBodySchema.parse({ assetId: UUID })).not.toThrow();
  });

  it("rejects a non-UUID assetId", () => {
    expect(() =>
      NeckPresignBodySchema.parse({ assetId: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects a missing assetId", () => {
    expect(() => NeckPresignBodySchema.parse({})).toThrow();
  });
});

describe("SaveNeckBodySchema", () => {
  const validBase = {
    assetId: UUID,
    neckParams: {},
    modelObjectKey: "users/u1/models/neck.glb",
    previewObjectKey: "users/u1/models/preview.png",
  };

  it("accepts a complete valid body", () => {
    expect(() => SaveNeckBodySchema.parse(validBase)).not.toThrow();
  });

  it("accepts optional modelBytes and previewBytes", () => {
    expect(() =>
      SaveNeckBodySchema.parse({
        ...validBase,
        modelBytes: 1024,
        previewBytes: 512,
      }),
    ).not.toThrow();
  });

  it("rejects empty modelObjectKey", () => {
    expect(() =>
      SaveNeckBodySchema.parse({ ...validBase, modelObjectKey: "" }),
    ).toThrow();
  });

  it("rejects empty previewObjectKey", () => {
    expect(() =>
      SaveNeckBodySchema.parse({ ...validBase, previewObjectKey: "" }),
    ).toThrow();
  });

  it("rejects negative modelBytes", () => {
    expect(() =>
      SaveNeckBodySchema.parse({ ...validBase, modelBytes: -1 }),
    ).toThrow();
  });

  it("accepts zero modelBytes", () => {
    expect(() =>
      SaveNeckBodySchema.parse({ ...validBase, modelBytes: 0 }),
    ).not.toThrow();
  });

  it("rejects fractional modelBytes (must be int)", () => {
    expect(() =>
      SaveNeckBodySchema.parse({ ...validBase, modelBytes: 1.5 }),
    ).toThrow();
  });
});
