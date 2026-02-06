import Link from "next/link";
import { Button } from "@/components/ui/button";
import ProjectPlayground from "@/components/project-playground";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Project Playground</h2>
        <Button asChild variant="outline">
          <Link href={`/api/models/export?projectId=${id}`}>
            Download model
          </Link>
        </Button>
      </div>
      <ProjectPlayground projectId={id} />
    </div>
  );
}
