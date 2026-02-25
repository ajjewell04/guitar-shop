import type { User } from "@supabase/supabase-js";
import { jsonError } from "@/app/api/_shared/http";

type AuthResult = {
  data: { user: User | null };
  error: unknown;
};

type SupabaseWithAuth = {
  auth: {
    getUser: () => Promise<AuthResult>;
  };
};

export async function requireUser<Supabase extends SupabaseWithAuth>(
  supabase: Supabase,
): Promise<{ supabase: Supabase; user: User } | Response> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonError("Unauthorized", 401);
  }

  return { supabase, user };
}
