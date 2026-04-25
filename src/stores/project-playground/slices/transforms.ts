import type { StateCreator } from "zustand";
import type { FullStore, TransformsSlice } from "../slice-types";
import type { NodeTransforms } from "../types";
import {
  normalizeNodeTransforms,
  toTransformInputDraft,
  updateTransformsByInputKey,
} from "../utils";

export const createTransformsSlice: StateCreator<
  FullStore,
  [],
  [],
  TransformsSlice
> = (set, get) => {
  const pendingNodeTransforms = new Map<string, NodeTransforms>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  async function persistNodeTransforms(
    nodeId: string,
    transforms: NodeTransforms,
  ) {
    const res = await fetch("/api/projects/nodes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId,
        position: transforms.position,
        rotation: transforms.rotation,
        scale: transforms.scale,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string })?.error ?? "Save failed.");
    }
  }

  return {
    transformInputDraftByNodeId: {},
    headstockTransformInputDraftByNodeId: {},

    getNodeTransformsById: (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      return normalizeNodeTransforms(node?.transforms);
    },

    setTransformInputValue: (nodeId, key, raw) =>
      set((state) => {
        const current =
          state.transformInputDraftByNodeId[nodeId] ??
          toTransformInputDraft(get().getNodeTransformsById(nodeId));
        return {
          transformInputDraftByNodeId: {
            ...state.transformInputDraftByNodeId,
            [nodeId]: { ...current, [key]: raw },
          },
        };
      }),

    commitTransformInput: (nodeId, key) => {
      const raw = get().transformInputDraftByNodeId[nodeId]?.[key];
      const current = get().getNodeTransformsById(nodeId);
      const fallback = toTransformInputDraft(current)[key];
      if (!raw || raw.trim() === "" || !Number.isFinite(Number(raw))) {
        get().setTransformInputValue(nodeId, key, fallback);
        return;
      }
      get().scheduleTransformSave(
        nodeId,
        updateTransformsByInputKey(current, key, Number(raw)),
      );
    },

    setHeadstockTransformInputValue: (nodeId, key, raw) =>
      set((state) => {
        const current =
          state.headstockTransformInputDraftByNodeId[nodeId] ??
          toTransformInputDraft(get().getHeadstockTransformsForNode(nodeId));
        return {
          headstockTransformInputDraftByNodeId: {
            ...state.headstockTransformInputDraftByNodeId,
            [nodeId]: { ...current, [key]: raw },
          },
        };
      }),

    commitHeadstockTransformInput: (nodeId, key) => {
      const raw = get().headstockTransformInputDraftByNodeId[nodeId]?.[key];
      const current = get().getHeadstockTransformsForNode(nodeId);
      const fallback = toTransformInputDraft(current)[key];
      if (!raw || raw.trim() === "" || !Number.isFinite(Number(raw))) {
        get().setHeadstockTransformInputValue(nodeId, key, fallback);
        return;
      }
      get().applyHeadstockTransformsToDraft(
        nodeId,
        updateTransformsByInputKey(current, key, Number(raw)),
      );
    },

    applyLocalNodeTransforms: (nodeId, transforms) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, transforms: { ...n.transforms, ...transforms } }
            : n,
        ),
        transformInputDraftByNodeId: {
          ...state.transformInputDraftByNodeId,
          [nodeId]: toTransformInputDraft(transforms),
        },
      })),

    scheduleTransformSave: (nodeId, transforms) => {
      get().applyLocalNodeTransforms(nodeId, transforms);
      pendingNodeTransforms.set(nodeId, transforms);

      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const pending = Array.from(pendingNodeTransforms.entries());
        pendingNodeTransforms.clear();
        try {
          await Promise.all(
            pending.map(([id, t]) => persistNodeTransforms(id, t)),
          );
        } catch {
          /* best-effort */
        }
      }, 300);
    },

    flushPendingNodeSaves: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      const pending = Array.from(pendingNodeTransforms.entries());
      if (!pending.length) return;
      pendingNodeTransforms.clear();
      await Promise.all(pending.map(([id, t]) => persistNodeTransforms(id, t)));
    },

    clearTransformDraft: (nodeId) => {
      pendingNodeTransforms.delete(nodeId);
      set((state) => {
        const ti = { ...state.transformInputDraftByNodeId };
        const hi = { ...state.headstockTransformInputDraftByNodeId };
        delete ti[nodeId];
        delete hi[nodeId];
        return {
          transformInputDraftByNodeId: ti,
          headstockTransformInputDraftByNodeId: hi,
        };
      });
    },
  };
};
