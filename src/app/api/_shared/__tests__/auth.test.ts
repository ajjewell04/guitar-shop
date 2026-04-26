import { describe, it, expect, vi } from "vitest";
import { requireUser } from "../auth";

vi.mock("@/app/api/_shared/http", () => ({
  jsonError: (_message: string, status: number) =>
    new Response(null, { status }),
}));

const makeSupabase = (user: unknown, error: unknown = null) => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user }, error }),
  },
});

describe("requireUser", () => {
  it("returns { supabase, user } when getUser resolves with a user", async () => {
    const user = { id: "user-1", email: "test@example.com" };
    const supabase = makeSupabase(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireUser(supabase as any);
    expect(result).toEqual({ supabase, user });
  });

  it("returns a 401 Response when getUser yields no user", async () => {
    const supabase = makeSupabase(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireUser(supabase as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("returns a 401 Response when getUser yields an error", async () => {
    const supabase = makeSupabase(null, new Error("session expired"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireUser(supabase as any);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
