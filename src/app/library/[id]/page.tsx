import CommunityLibraryView from "@/components/community-library";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserLibraryPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6">
      <CommunityLibraryView ownerId={id} />
    </div>
  );
}
