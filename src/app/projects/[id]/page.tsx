import ProjectPlayground from "@/components/project-playground";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-semibold">Project Playground</h2>
      <ProjectPlayground projectId={id} />
    </div>
  );
}
