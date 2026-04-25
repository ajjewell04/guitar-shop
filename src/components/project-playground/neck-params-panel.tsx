"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { useProjectPlaygroundStore } from "@/stores/project-playground/store";
import {
  NUMERIC_NECK_META,
  GENERAL_DIMENSION_NECK_KEYS,
  PROFILE_NUMERIC_NECK_KEYS,
  FRETBOARD_NUMERIC_NECK_KEYS,
  NUT_NUMERIC_NECK_KEYS,
  FRETS_NUMERIC_NECK_KEYS,
  HEEL_NUMERIC_NECK_KEYS,
  ALIGNMENT_NUMERIC_NECK_KEYS,
} from "@/stores/project-playground/constants";
import { DEFAULT_NECK_PARAMS, normalizeNeckParams } from "@/lib/neck/params";
import type { NumericNeckKey } from "@/stores/project-playground/types";
import { TransformSection } from "./transform-section";

type NeckParamsPanelProps = {
  getGroupForNode: (nodeId: string) => THREE.Group | null;
};

export function NeckParamsPanel({ getGroupForNode }: NeckParamsPanelProps) {
  const selectedNodeId = useProjectPlaygroundStore((s) => s.selectedNodeId);
  const nodes = useProjectPlaygroundStore((s) => s.nodes);
  const neckDraftByNodeId = useProjectPlaygroundStore(
    (s) => s.neckDraftByNodeId,
  );
  const headstockLoadByNodeId = useProjectPlaygroundStore(
    (s) => s.headstockLoadByNodeId,
  );
  const savingNeckNodeId = useProjectPlaygroundStore((s) => s.savingNeckNodeId);
  const libraryAssets = useProjectPlaygroundStore((s) => s.libraryAssets);
  const transformMode = useProjectPlaygroundStore((s) => s.transformMode);
  const neckTransformTarget = useProjectPlaygroundStore(
    (s) => s.neckTransformTarget,
  );

  const setNeckTransformTarget = useProjectPlaygroundStore(
    (s) => s.setNeckTransformTarget,
  );
  const updateNeckDraft = useProjectPlaygroundStore((s) => s.updateNeckDraft);
  const resetNeckDraft = useProjectPlaygroundStore((s) => s.resetNeckDraft);
  const setNeckNumberInput = useProjectPlaygroundStore(
    (s) => s.setNeckNumberInput,
  );
  const commitNeckNumberInput = useProjectPlaygroundStore(
    (s) => s.commitNeckNumberInput,
  );
  const applyAndSaveNeck = useProjectPlaygroundStore((s) => s.applyAndSaveNeck);
  const getHeadstockRenderState = useProjectPlaygroundStore(
    (s) => s.getNeckParamsForNode,
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const selectedNeckNode = useMemo(
    () => (selectedNode?.asset?.part_type === "neck" ? selectedNode : null),
    [selectedNode],
  );

  const headstockAssets = useMemo(
    () => libraryAssets.filter((a) => a.part_type === "headstock"),
    [libraryAssets],
  );
  const headstockAssetById = useMemo(
    () => new Map(headstockAssets.map((a) => [a.id, a])),
    [headstockAssets],
  );

  function resolveHeadstockRenderState(
    params: ReturnType<typeof getHeadstockRenderState>,
  ) {
    if (!params?.headstockAssetId)
      return {
        url: null as string | null,
        unavailableError: null as string | null,
      };
    const asset = headstockAssetById.get(params.headstockAssetId) ?? null;
    const url = asset?.modelUrl ?? null;
    return {
      url,
      unavailableError: !asset
        ? "Selected headstock is not available in your library."
        : !url
          ? "Selected headstock does not have a model file yet."
          : null,
    };
  }

  if (!selectedNeckNode) return null;

  const nodeId = selectedNeckNode.id;
  const currentParams = neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
  const isCompound = currentParams.fingerboardRadiusMode === "compound";
  const hsRenderState = resolveHeadstockRenderState(currentParams);
  const canTargetHs =
    !!currentParams.headstockAssetId &&
    !!hsRenderState.url &&
    !hsRenderState.unavailableError;
  const hsLoad = headstockLoadByNodeId[nodeId] ?? {
    status: "idle",
    message: null,
  };

  function renderNumberInput(key: NumericNeckKey) {
    const meta = NUMERIC_NECK_META[key];
    return (
      <label key={key}>
        {meta.label}
        <input
          className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
          type="number"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={String(currentParams[key] as number)}
          onChange={(e) => setNeckNumberInput(nodeId, key, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitNeckNumberInput(nodeId, key);
            }
          }}
          onBlur={() => commitNeckNumberInput(nodeId, key)}
        />
      </label>
    );
  }

  return (
    <aside className="h-[58vh] min-h-90 overflow-auto rounded-lg border border-white/10 bg-[#121a1a] p-3">
      <div className="mb-3 text-sm font-medium">Neck Parameters</div>

      <div className="space-y-3 text-xs">
        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Transform Target
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "rounded border px-2 py-1 text-[11px] transition",
                neckTransformTarget === "neck"
                  ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                  : "border-white/20 text-muted-foreground hover:bg-white/10",
              )}
              onClick={() => setNeckTransformTarget("neck")}
            >
              Neck
            </button>
            <button
              type="button"
              disabled={!canTargetHs}
              className={cn(
                "rounded border px-2 py-1 text-[11px] transition",
                neckTransformTarget === "headstock"
                  ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                  : "border-white/20 text-muted-foreground hover:bg-white/10",
                !canTargetHs &&
                  "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
              onClick={() => setNeckTransformTarget("headstock")}
            >
              Headstock
            </button>
          </div>
        </section>

        <TransformSection
          nodeId={nodeId}
          mode={transformMode}
          target={neckTransformTarget}
        />

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            General
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2">
              Headstock Asset
              <select
                className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                value={currentParams.headstockAssetId ?? ""}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  updateNeckDraft(nodeId, { headstockAssetId: nextId });
                  setNeckTransformTarget(nextId ? "headstock" : "neck");
                }}
              >
                <option value="">Select headstock</option>
                {headstockAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {currentParams.headstockAssetId ? (
                <div
                  className={cn(
                    "mt-1 text-[11px]",
                    hsLoad.status === "error"
                      ? "text-rose-300"
                      : "text-muted-foreground",
                  )}
                >
                  {hsLoad.status === "loading"
                    ? "Headstock model loading..."
                    : hsLoad.status === "ready"
                      ? "Headstock model ready."
                      : hsLoad.status === "error"
                        ? (hsLoad.message ?? "Headstock model failed to load.")
                        : "Waiting for headstock model."}
                </div>
              ) : null}
            </label>
            {GENERAL_DIMENSION_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Profile
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              Profile Type
              <select
                className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                value={currentParams.profileType ?? "C"}
                onChange={(e) =>
                  updateNeckDraft(nodeId, {
                    profileType: e.target
                      .value as typeof currentParams.profileType,
                  })
                }
              >
                <option value="C">C</option>
                <option value="U">U</option>
                <option value="V">V</option>
                <option value="D">D</option>
              </select>
            </label>
            {PROFILE_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fretboard
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2">
              Radius Mode
              <select
                className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                value={currentParams.fingerboardRadiusMode}
                onChange={(e) =>
                  updateNeckDraft(nodeId, {
                    fingerboardRadiusMode: e.target
                      .value as typeof currentParams.fingerboardRadiusMode,
                  })
                }
              >
                <option value="single">single</option>
                <option value="compound">compound</option>
              </select>
            </label>
            {renderNumberInput("fingerboardRadiusStartIn")}
            {isCompound ? (
              renderNumberInput("fingerboardRadiusEndIn")
            ) : (
              <div className="self-end pb-1 text-[11px] text-muted-foreground">
                End radius is locked to start radius in single mode.
              </div>
            )}
            {FRETBOARD_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Nut
          </div>
          <div className="grid grid-cols-2 gap-2">
            {NUT_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Frets
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FRETS_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Heel
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2">
              Heel Type
              <select
                className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
                value={currentParams.heelType}
                onChange={(e) =>
                  updateNeckDraft(nodeId, {
                    heelType: e.target.value as typeof currentParams.heelType,
                  })
                }
              >
                <option value="flat">flat</option>
                <option value="sculpted">sculpted</option>
              </select>
            </label>
            {HEEL_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>

        <section className="rounded border border-white/10 bg-black/10 p-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Alignment
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALIGNMENT_NUMERIC_NECK_KEYS.map((key) => renderNumberInput(key))}
          </div>
        </section>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded border border-emerald-400 px-3 py-1 text-xs"
          disabled={
            savingNeckNodeId === nodeId ||
            !neckDraftByNodeId[nodeId]?.headstockAssetId ||
            headstockLoadByNodeId[nodeId]?.status !== "ready"
          }
          onClick={() => {
            const group = getGroupForNode(nodeId);
            if (group) void applyAndSaveNeck(selectedNeckNode, group);
          }}
        >
          {savingNeckNodeId === nodeId ? "Saving..." : "Apply & Save"}
        </button>
        <button
          className="rounded border border-white/30 px-3 py-1 text-xs"
          onClick={() => resetNeckDraft(nodeId)}
        >
          Reset
        </button>
      </div>
    </aside>
  );
}

// Re-export normalizeNeckParams so the panel doesn't need to import it directly
export { normalizeNeckParams };
