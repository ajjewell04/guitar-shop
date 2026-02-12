import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";

type Project = {
  id: string;
  name: string;
};

type SidebarProps = {
  onNewProject?: () => void;
};

export default function Sidebar({ onNewProject }: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const supabase = createClient();

    const loadProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("created_on", { ascending: false });
      if (!isActive) return;

      if (error) {
        setError(error.message);
        setProjects([]);
        return;
      }

      setProjects(data ?? []);
    };

    loadProjects();

    const onProjectsChanged = () => {
      loadProjects();
    };

    window.addEventListener("projects-changed", onProjectsChanged);

    return () => {
      isActive = false;
      window.removeEventListener("projects-changed", onProjectsChanged);
    };
  }, []);

  const shownProjects = projects.slice(0, 5);
  const hasMoreProjects = projects.length > shownProjects.length;

  return (
    <aside className="flex h-screen justify-between flex-col bg-foreground px-8 py-6">
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="#">My Library</Link>
          </li>
          <li>
            <Link href="/library">Community Library</Link>
          </li>
        </ul>
      </nav>
      <section>
        <div className="flex justify-between items-center mb-4">
          <h4>Projects</h4>
          <Button
            id="newProjBtn"
            className="cursor-pointer text-xl rounded-lg p-2"
            onClick={onNewProject}
          >
            +
          </Button>
        </div>
        <ul className="flex flex-col items-center gap-4 overflow-y-auto">
          {error && (
            <li className="text-sm text-red-500">Failed to load projects.</li>
          )}
          {!error && projects.length === 0 && (
            <li className="text-sm text-muted-foreground">No projects yet.</li>
          )}
          {shownProjects.map((project) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`}>{project.name}</Link>
            </li>
          ))}
          {hasMoreProjects && (
            <li>
              <Link href="/">See all</Link>
            </li>
          )}
        </ul>
      </section>
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <a href="#">Help</a>
          </li>
          <li>
            <a href="#">Settings</a>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
