import { describe, it, expect, vi } from "vitest";
import { getOwnedProject, createProjectWithRoot } from "../service";

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
  };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedProject(db as any, projectId, userId);
    expect(result.reason).toBeNull();
    expect(result.project).toBeDefined();
  });

  it("returns { project: null, reason: 'not_found' } when the query errors", async () => {
    const db = makeDb({ data: null, error: { message: "not found" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedProject(db as any, projectId, userId);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getOwnedProject(db as any, projectId, userId);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await createProjectWithRoot(db as any, "My Project");
    expect(result.data).toEqual({
      project_id: "project-1",
      root_node_id: "node-1",
    });
    expect(result.error).toBeNull();
  });
});
