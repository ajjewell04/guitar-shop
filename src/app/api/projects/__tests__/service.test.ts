import { describe, it, expect, vi } from "vitest";
import type { supabaseServer } from "@/lib/supabase/server";
import {
  getOwnedProject,
  createProjectWithRoot,
  promoteProjectRoot,
  assignRootAsset,
  upsertProjectPreviewFile,
  attachProjectPreview,
} from "../service";

type DbClient = Awaited<ReturnType<typeof supabaseServer>>;

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));

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
    rpc: vi.fn().mockReturnValue(makeChain(result)),
  } as unknown as DbClient;
}

describe("getOwnedProject", () => {
  const userId = "user-1";
  const projectId = "project-1";

  it("returns { project, reason: null } when user owns the project", async () => {
    const db = makeDb({
      data: {
        id: projectId,
        owner_id: userId,
        root_node_id: null,
        preview_file_id: null,
      },
      error: null,
    });
    const result = await getOwnedProject(db, projectId, userId);
    expect(result.reason).toBeNull();
    expect(result.project).toBeDefined();
  });

  it("returns { project: null, reason: 'not_found' } when the query errors", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    const result = await getOwnedProject(db, projectId, userId);
    expect(result.reason).toBe("not_found");
    expect(result.project).toBeNull();
  });

  it("returns { project: null, reason: 'forbidden' } when another user owns the project", async () => {
    const db = makeDb({
      data: {
        id: projectId,
        owner_id: "other-user",
        root_node_id: null,
        preview_file_id: null,
      },
      error: null,
    });
    const result = await getOwnedProject(db, projectId, userId);
    expect(result.reason).toBe("forbidden");
    expect(result.project).toBeNull();
  });
});

describe("createProjectWithRoot", () => {
  it("returns data from the rpc call", async () => {
    const db = makeDb({
      data: { project_id: "project-1", root_node_id: "node-1" },
      error: null,
    });
    const result = await createProjectWithRoot(db, "My Project");
    expect(result.data).toEqual({
      project_id: "project-1",
      root_node_id: "node-1",
    });
    expect(result.error).toBeNull();
  });
});

describe("promoteProjectRoot", () => {
  it("returns data from the rpc call", async () => {
    const db = makeDb({
      data: { project_id: "project-1", root_node_id: "node-2" },
      error: null,
    });
    const result = await promoteProjectRoot(db, {
      projectId: "project-1",
      newRootNodeId: "node-2",
    });
    expect(result.data).toEqual({
      project_id: "project-1",
      root_node_id: "node-2",
    });
    expect(result.error).toBeNull();
  });
});

describe("assignRootAsset", () => {
  it("updates project_nodes with asset_id and last_updated", async () => {
    const chain = makeChain({ data: null, error: null });
    const fromFn = vi.fn().mockReturnValue(chain);
    const db = { from: fromFn, rpc: vi.fn() } as unknown as DbClient;
    await assignRootAsset(db, "node-1", "asset-1");
    expect(fromFn).toHaveBeenCalledWith("project_nodes");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "asset-1",
        last_updated: expect.any(String),
      }),
    );
  });
});

describe("upsertProjectPreviewFile", () => {
  const baseArgs = {
    userId: "user-1",
    objectKey: "previews/thumb.png",
    mimeType: "image/png",
    bytes: 1024,
    nowIso: "2024-01-01T00:00:00.000Z",
  };

  it("takes the update path when existingPreviewFileId is set", async () => {
    const db = makeDb({
      data: {
        id: "file-1",
        bucket: "test-bucket",
        object_key: "previews/thumb.png",
        mime_type: "image/png",
      },
      error: null,
    });
    const result = await upsertProjectPreviewFile(db, {
      ...baseArgs,
      existingPreviewFileId: "file-1",
    });
    expect(result.data).toBeDefined();
    expect(result.error).toBeNull();
  });

  it("takes the insert path when existingPreviewFileId is null", async () => {
    const db = makeDb({
      data: {
        id: "file-2",
        bucket: "test-bucket",
        object_key: "previews/thumb.png",
        mime_type: "image/png",
      },
      error: null,
    });
    const result = await upsertProjectPreviewFile(db, {
      ...baseArgs,
      existingPreviewFileId: null,
    });
    expect(result.data).toBeDefined();
    expect(result.error).toBeNull();
  });
});

describe("attachProjectPreview", () => {
  it("calls db.from with 'projects'", async () => {
    const fromFn = vi
      .fn()
      .mockReturnValue(makeChain({ data: null, error: null }));
    const db = { from: fromFn, rpc: vi.fn() } as unknown as DbClient;
    await attachProjectPreview(db, {
      projectId: "project-1",
      userId: "user-1",
      fileId: "file-1",
      nowIso: "2024-01-01T00:00:00.000Z",
    });
    expect(fromFn).toHaveBeenCalledWith("projects");
  });
});
