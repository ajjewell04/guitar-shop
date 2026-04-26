"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Project = {
  id: string;
  name: string;
};

type Asset = {
  id: string;
  name: string;
};

type SidebarProps = {
  onNewProject?: () => void;
  onNewAsset?: () => void;
  initialUserId?: string | null;
};

export default function Sidebar({
  onNewProject,
  onNewAsset,
  initialUserId,
}: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const userId = initialUserId ?? null;

  useEffect(() => {
    let isActive = true;
    const supabase = supabaseBrowser();

    const loadProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("created_on", { ascending: false });

      if (!isActive) return;

      if (error) {
        setProjectError(error.message);
        setProjects([]);
        return;
      }

      setProjectError(null);
      setProjects(data ?? []);
    };

    const loadAssets = async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, name")
        .order("upload_date", { ascending: false });

      if (!isActive) return;

      if (error) {
        setAssetError(error.message);
        setAssets([]);
        return;
      }

      setAssetError(null);
      setAssets(data ?? []);
    };

    void loadProjects();
    void loadAssets();

    const onProjectsChanged = () => {
      void loadProjects();
    };

    const onAssetsChanged = () => {
      void loadAssets();
    };

    window.addEventListener("projects-changed", onProjectsChanged);
    window.addEventListener("assets-changed", onAssetsChanged);

    return () => {
      isActive = false;
      window.removeEventListener("projects-changed", onProjectsChanged);
      window.removeEventListener("assets-changed", onAssetsChanged);
    };
  }, []);

  const shownProjects = projects.slice(0, 4);
  const hasMoreProjects = projects.length > shownProjects.length;

  const shownAssets = assets.slice(0, 4);
  const hasMoreAssets = assets.length > shownAssets.length;

  return (
    <aside className="flex h-screen justify-between flex-col bg-foreground px-8 py-6">
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href={userId ? `/library/${userId}` : "/library"}>
              My Library
            </Link>
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
          {projectError && (
            <li className="text-sm text-red-500">Failed to load projects.</li>
          )}
          {!projectError && projects.length === 0 && (
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

      <section>
        <div className="flex justify-between items-center mb-4">
          <h4>Assets</h4>
          <Button
            id="newAssetBtn"
            className="cursor-pointer text-xl rounded-lg p-2"
            onClick={onNewAsset}
          >
            +
          </Button>
        </div>
        <ul className="flex flex-col items-center gap-4 overflow-y-auto">
          {assetError && (
            <li className="text-sm text-red-500">Failed to load assets.</li>
          )}
          {!assetError && assets.length === 0 && (
            <li className="text-sm text-muted-foreground">No assets yet.</li>
          )}
          {shownAssets.map((asset) => (
            <li key={asset.id}>
              <Link href={userId ? `/library/${userId}` : "/library"}>
                {asset.name}
              </Link>
            </li>
          ))}
          {hasMoreAssets && (
            <li>
              <Link href={userId ? `/library/${userId}` : "/library"}>
                See all
              </Link>
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
