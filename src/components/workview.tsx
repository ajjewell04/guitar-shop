"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { PartFilters } from "@/components/ui/filters";

type WorkviewProps = { children: React.ReactNode } & {
  onNewProject?: () => void;
};

type NavConfig = {
  title: string;
  showSearch: boolean;
  showFilters: boolean;
};

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

  return (
    <main className="flex flex-1 flex-col m-h-0 bg-(--background2) rounded-lg m-2 px-2">
      <header className="flex h-16 justify-between items-center">
        <div className="text-xl font-bold">{navConfig.title}</div>
        {navConfig.showSearch && (
          <input
            className="flex flex-1 min-w-xs max-w-3xl rounded-2xl p-2 m-2 bg-(--background)"
            type="text"
            placeholder=" Search"
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
        <header className="flex h-auto justify-between items-start py-2">
          <PartFilters />
        </header>
      )}
      <hr />
      <section>{children}</section>
    </main>
  );
}
