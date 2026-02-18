"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PartFilters } from "@/components/ui/filters";

type WorkviewProps = { children: React.ReactNode } & {
  onNewProject?: () => void;
};

type NavConfig = {
  title: string;
  showSearch: boolean;
  showFilters: boolean;
};

type PartType =
  | "all"
  | "body"
  | "neck"
  | "headstock"
  | "bridge"
  | "tuning_machine"
  | "pickup"
  | "pickguard"
  | "knob"
  | "switch"
  | "strap_button"
  | "output_jack"
  | "miscellaneous";

type SortKey = "asc" | "desc";

function getNavConfig(pathname: string): NavConfig {
  if (pathname === "/") {
    return {
      title: "Projects",
      showSearch: true,
      showFilters: false,
    };
  }
  if (pathname === "/library") {
    return {
      title: "Community Library",
      showSearch: true,
      showFilters: true,
    };
  }
  if (pathname.startsWith("/projects/")) {
    return {
      title: "Project Playground",
      showSearch: false,
      showFilters: false,
    };
  }
  return {
    title: "Workview",
    showSearch: false,
    showFilters: false,
  };
}

export default function WorkView({ children, onNewProject }: WorkviewProps) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const navConfig = getNavConfig(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isLibrary = pathname?.startsWith("/library");
  const query = searchParams.get("q") ?? "";
  const part = (searchParams.get("part") as PartType | null) ?? "all";
  const sort = (searchParams.get("sort") as SortKey | null) ?? "asc";
  const [searchText, setSearchText] = useState(query);

  function updateLibraryParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });

    const qs = params.toString();
    router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
  }

  useEffect(() => {
    const fetchUser = createClient();

    fetchUser.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: authListener } = fetchUser.auth.onAuthStateChange(
      (event, session) => {
        setUserEmail(session?.user.email ?? null);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    if (!isLibrary) return;

    const handle = setTimeout(() => {
      const nextQ = searchText || null;
      const currentQ = query || null;
      if (nextQ !== currentQ) {
        updateLibraryParams({ q: nextQ });
      }
    }, 500);

    return () => clearTimeout(handle);
  }, [searchText, isLibrary, query]);

  return (
    <main className="flex flex-1 flex-col min-h-0 bg-(--background2) rounded-lg m-2 px-2 overflow-hidden">
      <header className="flex h-16 justify-between items-center">
        <div className="text-xl font-bold">{navConfig.title}</div>
        {navConfig.showSearch && (
          <input
            className="flex flex-1 min-w-xs max-w-3xl rounded-2xl p-2 m-2 bg-(--background)"
            type="text"
            placeholder=" Search"
            value={isLibrary ? searchText : ""}
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
              updateLibraryParams({
                part: nextPart === "all" ? null : nextPart,
              })
            }
            onSortChange={(nextSort) =>
              updateLibraryParams({
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
