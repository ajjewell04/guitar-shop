import type { StateCreator } from "zustand";
import type { FullStore, UISlice } from "../slice-types";

export const createUISlice: StateCreator<FullStore, [], [], UISlice> = (
  set,
) => {
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    selectedNodeId: null,
    transformMode: "translate",
    neckTransformTarget: "neck",
    orbitEnabled: true,
    loadedNodeIds: new Set(),
    hideModelLoadBadge: false,
    modelLoadBadgeTimedOut: false,
    activePart: "all",
    assetSort: "asc",
    assemblyWarnings: [],
    toastMessage: null,
    assetSearch: "",

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setTransformMode: (mode) => set({ transformMode: mode }),
    setNeckTransformTarget: (target) => set({ neckTransformTarget: target }),
    setOrbitEnabled: (enabled) => set({ orbitEnabled: enabled }),

    markNodeLoaded: (nodeId) =>
      set((state) => {
        if (state.loadedNodeIds.has(nodeId)) return {};
        const next = new Set(state.loadedNodeIds);
        next.add(nodeId);
        return { loadedNodeIds: next };
      }),

    resetLoadedNodes: () => set({ loadedNodeIds: new Set() }),
    setHideModelLoadBadge: (hide) => set({ hideModelLoadBadge: hide }),
    setModelLoadBadgeTimedOut: (timedOut) =>
      set({ modelLoadBadgeTimedOut: timedOut }),
    setActivePart: (part) => set({ activePart: part }),
    setAssetSort: (sort) => set({ assetSort: sort }),
    setAssemblyWarnings: (warnings) => set({ assemblyWarnings: warnings }),

    showToast: (message) => {
      set({ toastMessage: message });
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        set({ toastMessage: null });
        toastTimer = null;
      }, 3500);
    },
  };
};
