import { describe, it, expect } from "vitest";
import {
  GetProjectNodesQuerySchema,
  CreateProjectNodeBodySchema,
  PatchProjectNodeBodySchema,
  DeleteProjectNodeBodySchema,
} from "../dto";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const UUID3 = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

describe("GetProjectNodesQuerySchema", () => {
  it("accepts valid UUID projectId", () => {
    expect(() =>
      GetProjectNodesQuerySchema.parse({ projectId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID projectId", () => {
    expect(() =>
      GetProjectNodesQuerySchema.parse({ projectId: "bad" }),
    ).toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() => GetProjectNodesQuerySchema.parse({})).toThrow();
  });
});

describe("CreateProjectNodeBodySchema", () => {
  it("accepts projectId and assetId without parentId", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({ projectId: UUID, assetId: UUID2 }),
    ).not.toThrow();
  });
  it("accepts all three fields", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({
        projectId: UUID,
        assetId: UUID2,
        parentId: UUID3,
      }),
    ).not.toThrow();
  });
  it("accepts null parentId", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({
        projectId: UUID,
        assetId: UUID2,
        parentId: null,
      }),
    ).not.toThrow();
  });
  it("rejects non-UUID assetId", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({ projectId: UUID, assetId: "bad" }),
    ).toThrow();
  });
  it("rejects missing projectId", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({ assetId: UUID2 }),
    ).toThrow();
  });
  it("rejects missing assetId", () => {
    expect(() =>
      CreateProjectNodeBodySchema.parse({ projectId: UUID }),
    ).toThrow();
  });
});

describe("PatchProjectNodeBodySchema", () => {
  it("rejects when no optional fields are present", () => {
    expect(() => PatchProjectNodeBodySchema.parse({ nodeId: UUID })).toThrow();
  });
  it("accepts when only scale is present", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, scale: 1.5 }),
    ).not.toThrow();
  });
  it("accepts when only parentId null is present", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, parentId: null }),
    ).not.toThrow();
  });
  it("accepts when only position is present", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({
        nodeId: UUID,
        position: { x: 1, y: 2, z: 3 },
      }),
    ).not.toThrow();
  });
  it("accepts when only rotation is present", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({
        nodeId: UUID,
        rotation: { x: 0, y: 90, z: 0 },
      }),
    ).not.toThrow();
  });
  it("accepts when only assetId is present", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, assetId: UUID2 }),
    ).not.toThrow();
  });
  it("rejects scale below minimum (0.01)", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, scale: 0 }),
    ).toThrow();
  });
  it("rejects scale above maximum (10)", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, scale: 11 }),
    ).toThrow();
  });
  it("accepts scale at boundaries", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, scale: 0.01 }),
    ).not.toThrow();
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: UUID, scale: 10 }),
    ).not.toThrow();
  });
  it("rejects missing nodeId", () => {
    expect(() => PatchProjectNodeBodySchema.parse({ scale: 1 })).toThrow();
  });
  it("rejects non-UUID nodeId", () => {
    expect(() =>
      PatchProjectNodeBodySchema.parse({ nodeId: "bad", scale: 1 }),
    ).toThrow();
  });
});

describe("DeleteProjectNodeBodySchema", () => {
  it("accepts valid UUID nodeId", () => {
    expect(() =>
      DeleteProjectNodeBodySchema.parse({ nodeId: UUID }),
    ).not.toThrow();
  });
  it("rejects non-UUID nodeId", () => {
    expect(() =>
      DeleteProjectNodeBodySchema.parse({ nodeId: "bad" }),
    ).toThrow();
  });
  it("rejects missing nodeId", () => {
    expect(() => DeleteProjectNodeBodySchema.parse({})).toThrow();
  });
});
