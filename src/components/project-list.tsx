"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  saveProjectPreview,
  toPreviewNodes,
} from "@/lib/project-preview-client";

type ProjectRow = {
  previewUrl: string | null;
  id: string;
  owner_id: string;
  name: string;
  created_on: string;
  last_updated: string;
};

type ProjectNodesPayload = {
  nodes?: Array<{
    id: string;
    parent_id: string | null;
    transforms?: {
      position?: { x: number; y: number; z: number };
      rotation?: { x: number; y: number; z: number };
      scale?: number;
    } | null;
    asset?: { modelUrl?: string | null } | null;
  }>;
  error?: string;
};

type ProjectListProps = {
  initialProjects: ProjectRow[];
};

export function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const attemptedRegenerationRef = useRef<Set<string>>(new Set());
  const inFlightRegenerationRef = useRef<Set<string>>(new Set());

  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload?.error ?? "Failed to load projects");
      setProjects([]);
      return;
    }
    setError(null);
    setProjects((payload.projects ?? []) as ProjectRow[]);
  }, []);

  const regenerateProjectPreview = async (projectId: string, force = false) => {
    if (inFlightRegenerationRef.current.has(projectId)) return;
    if (!force && attemptedRegenerationRef.current.has(projectId)) return;

    attemptedRegenerationRef.current.add(projectId);
    inFlightRegenerationRef.current.add(projectId);

    try {
      const res = await fetch(`/api/projects/nodes?projectId=${projectId}`, {
        cache: "no-store",
      });
      const payload = (await res
        .json()
        .catch(() => ({}))) as ProjectNodesPayload;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to load nodes for preview");
      }

      const previewNodes = toPreviewNodes(payload.nodes ?? []);
      if (!previewNodes.length) return;

      await saveProjectPreview(projectId, previewNodes);
      await loadProjects();
      window.dispatchEvent(new Event("projects-changed"));
    } catch {
      // Best effort background regeneration
    } finally {
      inFlightRegenerationRef.current.delete(projectId);
    }
  };

  useEffect(() => {
    const missingPreviewIds = projects
      .filter((p) => !p.previewUrl)
      .map((p) => p.id);

    if (!missingPreviewIds.length) return;

    let cancelled = false;

    const run = async () => {
      for (const projectId of missingPreviewIds) {
        if (cancelled) break;
        await regenerateProjectPreview(projectId);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  useEffect(() => {
    const onProjectsChanged = () => void loadProjects();
    window.addEventListener("projects-changed", onProjectsChanged);
    return () =>
      window.removeEventListener("projects-changed", onProjectsChanged);
  }, [loadProjects]);

  const onDelete = async (projectId: string) => {
    setError(null);
    setDeletingProjectId(projectId);

    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== projectId));

    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProjects(previous);
        throw new Error(data?.error ?? "Delete failed");
      }

      window.dispatchEvent(
        new CustomEvent("project-deleted", { detail: { id: projectId } }),
      );
      window.dispatchEvent(new Event("projects-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingProjectId(null);
    }
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
                  className="cursor-pointer border-red-600 text-red-600"
                  variant="outline"
                  disabled={deletingProjectId === project.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(project.id);
                  }}
                >
                  {deletingProjectId === project.id ? "Deleting..." : "Delete"}
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
                      onError={() => {
                        setProjects((prev) =>
                          prev.map((p) =>
                            p.id === project.id
                              ? { ...p, previewUrl: null }
                              : p,
                          ),
                        );
                        void regenerateProjectPreview(project.id, true);
                      }}
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
