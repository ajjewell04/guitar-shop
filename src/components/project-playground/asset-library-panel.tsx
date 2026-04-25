"use client";

import { useMemo } from "react";
import Image from "next/image";
import { PartFilters } from "@/components/ui/filters";
import { useProjectPlaygroundStore } from "@/stores/project-playground/store";

export function AssetLibraryPanel() {
  const libraryAssets = useProjectPlaygroundStore((s) => s.libraryAssets);
  const activePart = useProjectPlaygroundStore((s) => s.activePart);
  const assetSort = useProjectPlaygroundStore((s) => s.assetSort);
  const addingAssetId = useProjectPlaygroundStore((s) => s.addingAssetId);
  const creatingNeck = useProjectPlaygroundStore((s) => s.creatingNeck);

  const setActivePart = useProjectPlaygroundStore((s) => s.setActivePart);
  const setAssetSort = useProjectPlaygroundStore((s) => s.setAssetSort);
  const addAssetToProject = useProjectPlaygroundStore(
    (s) => s.addAssetToProject,
  );
  const createParameterizedNeck = useProjectPlaygroundStore(
    (s) => s.createParameterizedNeck,
  );
  const loadProjectData = useProjectPlaygroundStore((s) => s.loadProjectData);

  const visibleLibraryAssets = useMemo(() => {
    const rows =
      activePart !== "all"
        ? libraryAssets.filter((a) => a.part_type === activePart)
        : [...libraryAssets];
    rows.sort((a, b) => {
      const ta = new Date(a.upload_date ?? 0).getTime();
      const tb = new Date(b.upload_date ?? 0).getTime();
      return assetSort === "desc" ? ta - tb : tb - ta;
    });
    return rows;
  }, [libraryAssets, activePart, assetSort]);

  return (
    <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-[#0f1616] p-3">
      <div className="mb-2 text-sm text-muted-foreground">
        <div className="mb-3 flex flex-row gap-3">
          <div className="flex items-center">My Assets</div>
          <PartFilters
            activePart={activePart}
            sort={assetSort}
            onPartChange={setActivePart}
            onSortChange={setAssetSort}
          />
        </div>
      </div>

      {libraryAssets.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No assets available in your library.
        </div>
      ) : activePart === "neck" ? (
        <div className="overflow-x-auto overflow-y-hidden pb-2">
          <div className="grid grid-flow-col auto-cols-[160px] gap-3">
            <button
              type="button"
              className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 text-left transition hover:bg-emerald-500/20"
              onClick={() => void createParameterizedNeck()}
              disabled={creatingNeck}
            >
              <div className="relative mb-2 h-20 w-full overflow-hidden rounded bg-black/30">
                <div className="flex h-full items-center justify-center text-2xl text-emerald-300">
                  +
                </div>
              </div>
              <div className="truncate text-xs font-medium">
                New Parameterized Neck
              </div>
              <div className="mt-2 text-[11px] text-emerald-300">
                {creatingNeck ? "Creating..." : "Create + Add"}
              </div>
            </button>

            {visibleLibraryAssets.length === 0 ? (
              <div className="flex h-full items-center text-sm text-muted-foreground">
                No assets match your current filters.
              </div>
            ) : (
              visibleLibraryAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  addingAssetId={addingAssetId}
                  onAdd={() => void addAssetToProject(asset.id)}
                  onError={() => void loadProjectData()}
                />
              ))
            )}
          </div>
        </div>
      ) : visibleLibraryAssets.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No assets match your current filters.
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-hidden pb-2">
          <div className="grid grid-flow-col auto-cols-[160px] gap-3">
            {visibleLibraryAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                addingAssetId={addingAssetId}
                onAdd={() => void addAssetToProject(asset.id)}
                onError={() => void loadProjectData()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetCard({
  asset,
  addingAssetId,
  onAdd,
  onError,
}: {
  asset: {
    id: string;
    name: string;
    part_type: string | null;
    previewUrl: string | null;
    upload_date?: string | null;
  };
  addingAssetId: string | null;
  onAdd: () => void;
  onError: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-white/10 bg-black/20 p-2 text-left transition hover:bg-(--primary)"
      onClick={onAdd}
      disabled={addingAssetId === asset.id}
    >
      <div className="relative mb-2 h-20 w-full overflow-hidden rounded bg-black/30">
        {asset.previewUrl ? (
          <Image
            src={asset.previewUrl}
            alt={`${asset.name} preview`}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw"
            className="object-cover"
            onError={onError}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No preview
          </div>
        )}
      </div>
      <div className="truncate text-xs font-medium">{asset.name}</div>
      <div className="truncate text-[11px] text-muted-foreground">
        {asset.part_type?.replace(/_/g, " ") ?? "untyped"}
      </div>
      <div className="mt-2 text-[11px] text-emerald-300">
        {addingAssetId === asset.id ? "Adding..." : "Add to project"}
      </div>
    </button>
  );
}
