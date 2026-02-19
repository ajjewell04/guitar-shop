import { redirect } from "next/navigation";
import CommunityLibraryView from "@/components/community-library";
import { supabaseServer } from "@/lib/supabase";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserLibraryPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");
  if (id !== user.id) redirect("/library");

  return (
    <div className="flex flex-col gap-6">
      <CommunityLibraryView ownerId={id} />
    </div>
  );
}
