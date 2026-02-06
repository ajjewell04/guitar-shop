"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";
import { createClient } from "@/lib/client";
import { useEffect, useState } from "react";

type ProjectRow = {
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

  const loadProjects = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id, owner_id, name, created_on, last_updated")
      .order("last_updated", { ascending: false });

    if (error) {
      setError(error.message);
      setProjects([]);
      return;
    }
    setProjects((data ?? []) as ProjectRow[]);
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
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 m-4">
      {projects.map((project) => {
        return (
          <Card key={project.id}>
            <CardHeader className="flex justify-between">
              <Link href={`/projects/${project.id}`}>
                <CardTitle>{project.name}</CardTitle>
              </Link>
              <Button
                className="cursor-pointer text-xl rounded-lg p-2 bg-red-700"
                variant="outline"
                onClick={() => onDelete(project.id)}
              >
                🗑️
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Last Edited:{" "}
                {new Date(project.last_updated).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
