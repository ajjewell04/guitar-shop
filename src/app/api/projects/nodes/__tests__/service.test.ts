import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getOwnedProject,
  getOwnedAsset,
  getNextSortIndex,
  buildInitialTransforms,
  mergeTransforms,
} from "../service";

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const m of [
    "select",
    "eq",
    "insert",
    "update",
    "delete",
    "order",
    "limit",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

function makeDb(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue(makeChain(result)),
  } as unknown as SupabaseClient<Database>;
}

describe("getOwnedProject (nodes service)", () => {
  const userId = "user-1";
  const projectId = "project-1";

  it("returns { project, reason: null } when user owns the project", async () => {
    const db = makeDb({
      data: { id: projectId, owner_id: userId, root_node_id: null },
      error: null,
    });
    const { project, reason } = await getOwnedProject(db, projectId, userId);
    expect(reason).toBeNull();
    expect(project).toBeDefined();
  });

  it("returns 'not_found' when query returns an error", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    const { reason } = await getOwnedProject(db, projectId, userId);
    expect(reason).toBe("not_found");
  });

  it("returns 'forbidden' when another user owns the project", async () => {
    const db = makeDb({
      data: { id: projectId, owner_id: "other-user", root_node_id: null },
      error: null,
    });
    const { reason } = await getOwnedProject(db, projectId, userId);
    expect(reason).toBe("forbidden");
  });
});

describe("getOwnedAsset (nodes service)", () => {
  const userId = "user-1";
  const assetId = "asset-1";

  it("returns { asset, reason: null } when user owns the asset", async () => {
    const db = makeDb({
      data: { id: assetId, owner_id: userId, name: "Body" },
      error: null,
    });
    const { asset, reason } = await getOwnedAsset(db, assetId, userId);
    expect(reason).toBeNull();
    expect(asset).toBeDefined();
  });

  it("returns 'not_found' when query returns an error", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    const { reason } = await getOwnedAsset(db, assetId, userId);
    expect(reason).toBe("not_found");
  });

  it("returns 'forbidden' when another user owns the asset", async () => {
    const db = makeDb({
      data: { id: assetId, owner_id: "other-user", name: "Body" },
      error: null,
    });
    const { reason } = await getOwnedAsset(db, assetId, userId);
    expect(reason).toBe("forbidden");
  });
});

describe("getNextSortIndex", () => {
  const projectId = "project-1";

  it("returns { nextSortIndex: null, error } when the query errors", async () => {
    const db = makeDb({ data: null, error: { message: "db error" } });
    const result = await getNextSortIndex(db, projectId);
    expect(result.nextSortIndex).toBeNull();
    expect(result.error).toBeDefined();
  });

  it("returns nextSortIndex of 0 when the table is empty (data is null)", async () => {
    const db = makeDb({ data: null, error: null });
    const result = await getNextSortIndex(db, projectId);
    expect(result.nextSortIndex).toBe(0);
    expect(result.error).toBeNull();
  });

  it("returns nextSortIndex as sort_index + 1", async () => {
    const db = makeDb({ data: { sort_index: 4 }, error: null });
    const result = await getNextSortIndex(db, projectId);
    expect(result.nextSortIndex).toBe(5);
    expect(result.error).toBeNull();
  });
});

describe("buildInitialTransforms", () => {
  it("returns zeroed position and rotation with scale 1", () => {
    const transforms = buildInitialTransforms();
    expect(transforms.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(transforms.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(transforms.scale).toBe(1);
  });
});

describe("mergeTransforms", () => {
  it("applies a position patch to an existing transforms object", () => {
    const base = { position: { x: 1, y: 2, z: 3 }, scale: 2 };
    const result = mergeTransforms(base, { position: { x: 10, y: 20, z: 30 } });
    expect(result.position).toEqual({ x: 10, y: 20, z: 30 });
    expect(result.scale).toBe(2);
  });

  it("applies a scale patch without affecting other fields", () => {
    const base = { position: { x: 1, y: 0, z: 0 }, scale: 1 };
    const result = mergeTransforms(base, { scale: 3 });
    expect(result.scale).toBe(3);
    expect(result.position).toEqual({ x: 1, y: 0, z: 0 });
  });

  it("treats null transforms as an empty object", () => {
    const result = mergeTransforms(null, { scale: 2 });
    expect(result.scale).toBe(2);
  });

  it("applies a rotation patch without affecting other fields", () => {
    const base = { position: { x: 1, y: 0, z: 0 }, scale: 2 };
    const result = mergeTransforms(base, {
      rotation: { x: 0, y: 90, z: 0 },
    });
    expect(result.rotation).toEqual({ x: 0, y: 90, z: 0 });
    expect(result.scale).toBe(2);
  });
});
