"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PartFilters,
  type PartType,
  type SortKey,
} from "@/components/ui/filters";

type WorkviewProps = {
  children: React.ReactNode;
  onNewProject?: () => void;
  initialUserEmail?: string | null;
};

type NavConfig = {
  title: string;
  showSearch: boolean;
  showFilters: boolean;
};

function getNavConfig(pathname: string): NavConfig {
  if (pathname === "/") {
    return { title: "Projects", showSearch: true, showFilters: false };
  }
  if (pathname === "/library") {
    return { title: "Community Library", showSearch: true, showFilters: true };
  }
  if (pathname.startsWith("/library/")) {
    return { title: "My Library", showSearch: true, showFilters: true };
  }
  if (pathname.startsWith("/projects/")) {
    return {
      title: "Project Playground",
      showSearch: false,
      showFilters: false,
    };
  }
  return { title: "Workview", showSearch: false, showFilters: false };
}

export default function WorkView({
  children,
  onNewProject,
  initialUserEmail,
}: WorkviewProps) {
  const [userEmail, setUserEmail] = useState<string | null>(
    initialUserEmail ?? null,
  );
  const pathname = usePathname();
  const navConfig = getNavConfig(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isLibrary = pathname?.startsWith("/library");
  const isHome = pathname === "/";
  const query = searchParams.get("q") ?? "";
  const part = (searchParams.get("part") as PartType | null) ?? "all";
  const sort = (searchParams.get("sort") as SortKey | null) ?? "asc";
  const [searchText, setSearchText] = useState(query);

  function updatePageParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });

    const qs = params.toString();
    const targetPath = pathname || "/";
    router.replace(qs ? `${targetPath}?${qs}` : targetPath, { scroll: false });
  }

  useEffect(() => {
    const supabase = createClient();
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserEmail(session?.user.email ?? null);
      },
    );
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    if (!isLibrary && !isHome) return;

    const handle = setTimeout(() => {
      const nextQ = searchText || null;
      const currentQ = query || null;
      if (nextQ !== currentQ) {
        updatePageParams({ q: nextQ });
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [searchText, isLibrary, query]);

  useEffect(() => {
    return () => {
      if (!pathname?.startsWith("/projects/")) return;
      const projectId = pathname.split("/")[2];
      if (!projectId) return;
      window.dispatchEvent(
        new CustomEvent("project-workview-exit", { detail: { projectId } }),
      );
    };
  }, [pathname]);

  return (
    <main className="flex flex-1 flex-col min-h-0 bg-(--background2) rounded-lg m-2 px-2 overflow-hidden">
      <header className="flex h-16 justify-between items-center">
        <div className="text-xl font-bold">{navConfig.title}</div>
        {navConfig.showSearch && (
          <input
            className="flex flex-1 min-w-xs max-w-3xl rounded-2xl p-2 m-2 bg-(--background)"
            type="text"
            placeholder={isHome ? " Search Projects" : " Search Library"}
            value={navConfig.showSearch ? searchText : ""}
            onChange={(e) => setSearchText(e.target.value)}
          />
        )}
        <div className="flex gap-6">
          <Button
            id="newProjBtn"
            className="cursor-pointer text-base rounded-lg p-2"
            onClick={onNewProject}
          >
            + New Project
          </Button>
          {userEmail ? (
            <Link
              className="cursor-pointer text-base rounded-lg p-2"
              href="/auth/protected"
            >
              {userEmail}
            </Link>
          ) : (
            <Link href="/auth/login">Login</Link>
          )}
        </div>
      </header>

      {navConfig.showFilters && (
        <header className="flex h-auto justify-evenly items-start py-2">
          <PartFilters
            activePart={part}
            sort={sort}
            onPartChange={(nextPart) =>
              updatePageParams({
                part: nextPart === "all" ? null : nextPart,
              })
            }
            onSortChange={(nextSort) =>
              updatePageParams({
                sort: nextSort === "asc" ? null : nextSort,
              })
            }
          />
        </header>
      )}
      <hr />
      <section className="flex-1 min-h-0 overflow-y-auto ">{children}</section>
    </main>
  );
}
