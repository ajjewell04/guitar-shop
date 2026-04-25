import { LogoutButton } from "@/components/auth/logout-button";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ProtectedPage() {
  const _supabase = await supabaseServer();

  return (
    <div className="flex h-svh w-full items-center justify-center gap-2">
      <p>Hello</p>
      <LogoutButton />
    </div>
  );
}
