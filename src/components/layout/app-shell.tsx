"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import WorkView from "@/components/layout/workview";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { NewAssetForm } from "@/components/assets/new-asset-form";

type AppShellProps = {
  children: React.ReactNode;
  initialUser: { id: string; email: string | null } | null;
};

export function AppShell({ children, initialUser }: AppShellProps) {
  const router = useRouter();
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isNewAssetOpen, setIsNewAssetOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <div className="flex flex-col h-screen">
        <header className="flex flex-col p-8">
          <h1 className="self-center text-3xl font-bold">Guitarshop</h1>
        </header>
        <Sidebar
          onNewProject={() => setIsNewProjectOpen(true)}
          onNewAsset={() => setIsNewAssetOpen(true)}
          initialUserId={initialUser?.id ?? null}
        />
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <WorkView
          onNewProject={() => setIsNewProjectOpen(true)}
          initialUserEmail={initialUser?.email ?? null}
        >
          {children}
        </WorkView>
      </Suspense>
      {isNewProjectOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex min-h-svh w-full justify-center items-center p-6 md:p-10"
          onClick={() => setIsNewProjectOpen(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <NewProjectForm onSuccess={() => setIsNewProjectOpen(false)} />
          </div>
        </div>
      )}
      {isNewAssetOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex min-h-svh w-full justify-center items-center p-6 md:p-10"
          onClick={() => setIsNewAssetOpen(false)}
        >
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <NewAssetForm
              onSuccess={(assetId) => {
                setIsNewAssetOpen(false);
                router.push(`/library/${assetId}/configure-mounting`);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
