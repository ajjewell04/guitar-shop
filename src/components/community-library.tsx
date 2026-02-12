import { cn } from "@/lib/utils";

type CommunityLibraryViewProps = React.ComponentPropsWithoutRef<"div">;

export default function CommunityLibraryView({
  className,
}: CommunityLibraryViewProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <h2 className="text-2xl font-semibold">Community Library</h2>
      <p>Explore guitar/part models shared by the community.</p>
    </div>
  );
}
