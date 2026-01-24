import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/server";

export default async function ProtectedPage() {
  const supabase = await createClient();

  return (
    <div className="flex h-svh w-full items-center justify-center gap-2">
      <p>Hello</p>
      <LogoutButton />
    </div>
  );
}
