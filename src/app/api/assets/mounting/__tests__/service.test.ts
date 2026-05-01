import { describe, it, expect, vi, beforeEach } from "vitest";
import type { supabaseServer } from "@/lib/supabase/server";
import { saveMounting } from "../service";
import type { GuitarMeta } from "@/lib/guitar/schema";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));

function makeChain(result: { data: unknown; error: unknown }) {
  const resolved = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // Make chain thenable so bare `await db.from().update().eq()` resolves to result
    then: resolved.then.bind(resolved),
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

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const assetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const vec3 = { x: 0, y: 0, z: 0 };

const bodyGuitar: GuitarMeta = {
  kind: "body",
  frameRotation: vec3,
  neckPocket: { origin: vec3, rotation: vec3 },
};

describe("saveMounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the asset is not found", async () => {
    const db = {
      from: vi
        .fn()
        .mockReturnValue(
          makeChain({ data: null, error: { message: "not found" } }),
        ),
    };
    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });
    expect(result.error?.status).toBe(404);
  });

  it("returns 403 when the asset is owned by another user", async () => {
    const db = {
      from: vi.fn().mockReturnValue(
        makeChain({
          data: {
            id: assetId,
            owner_id: "other-user",
            part_type: "body",
            meta: {},
          },
          error: null,
        }),
      ),
    };
    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });
    expect(result.error?.status).toBe(403);
  });

  it("returns 400 when guitar.kind does not match asset.part_type", async () => {
    const db = {
      from: vi.fn().mockReturnValue(
        makeChain({
          data: {
            id: assetId,
            owner_id: userId,
            part_type: "bridge",
            meta: {},
          },
          error: null,
        }),
      ),
    };
    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });
    expect(result.error?.status).toBe(400);
    expect(result.error?.message).toContain("body");
    expect(result.error?.message).toContain("bridge");
  });

  it("preserves existing meta keys alongside the new guitar key", async () => {
    const existingMeta = { neck: { scaleLengthIn: 25.5 }, source: "import" };

    const selectChain = makeChain({
      data: {
        id: assetId,
        owner_id: userId,
        part_type: "body",
        meta: existingMeta,
      },
      error: null,
    });

    let capturedPayload: Record<string, unknown> | null = null;
    const updateChain = makeChain({ data: null, error: null });
    updateChain["update"] = vi.fn().mockImplementation((payload: unknown) => {
      capturedPayload = payload as Record<string, unknown>;
      return updateChain;
    });

    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain),
    };

    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });

    expect(result.error).toBeNull();
    expect(capturedPayload).not.toBeNull();
    const meta = capturedPayload!["meta"] as Record<string, unknown>;
    expect(meta["neck"]).toEqual(existingMeta.neck);
    expect(meta["source"]).toBe("import");
    expect(meta["guitar"]).toEqual(bodyGuitar);
  });

  it("returns null error on successful save", async () => {
    const selectChain = makeChain({
      data: { id: assetId, owner_id: userId, part_type: "body", meta: {} },
      error: null,
    });
    const updateChain = makeChain({ data: null, error: null });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain),
    };
    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });
    expect(result.error).toBeNull();
  });

  it("returns 400 when the database UPDATE fails", async () => {
    const selectChain = makeChain({
      data: { id: assetId, owner_id: userId, part_type: "body", meta: {} },
      error: null,
    });
    const updateChain = makeChain({
      data: null,
      error: { message: "constraint violation" },
    });
    const db = {
      from: vi
        .fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain),
    };
    const result = await saveMounting(db as unknown as Db, userId, {
      assetId,
      guitar: bodyGuitar,
    });
    expect(result.error?.status).toBe(400);
    expect(result.error?.message).toContain("constraint violation");
  });
});
