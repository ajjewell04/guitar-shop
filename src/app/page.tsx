"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type ProjectRow = {
  previewUrl: string | undefined;
  id: string;
  owner_id: string;
  name: string;
  created_on: string;
  last_updated: string;
};

export default function Home({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const loadProjects = async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload?.error ?? "Failed to load projects");
      setProjects([]);
      return;
    }
    setError(null);
    setProjects((payload.projects ?? []) as ProjectRow[]);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const onDelete = async (projectId: string) => {
    const res = await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? "Delete failed");
    }

    await loadProjects();
    window.dispatchEvent(new Event("projects-changed"));
  };

  const visibleProjects = useMemo(() => {
    if (!q) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(q));
  }, [projects, q]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 m-4">
      {error && <div className="text-red-500">{error}</div>}

      {!error && visibleProjects.length === 0 && (
        <div className="text-muted-foreground">
          No projects match your search.
        </div>
      )}

      {visibleProjects.map((project) => {
        return (
          <Link key={project.id} href={`/projects/${project.id}`}>
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>{project.name}</CardTitle>
                <Button
                  className="cursor-pointer text-xl rounded-lg p-2 bg-red-700"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(project.id);
                  }}
                >
                  🗑️
                </Button>
              </CardHeader>
              <CardContent className="flex flex-row items-start gap-2">
                <div className="relative h-100 w-100 mb-4 bg-black/20 rounded-t-lg overflow-hidden">
                  {project.previewUrl ? (
                    <Image
                      src={project.previewUrl}
                      alt={`${project.name} preview`}
                      fill={true}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      No preview available
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Last Edited:{" "}
                  {new Date(project.last_updated).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
