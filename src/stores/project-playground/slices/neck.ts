import type { StateCreator } from "zustand";
import type { FullStore, NeckSlice } from "../slice-types";
import type { NumericNeckKey } from "../types";
import {
  DEFAULT_NECK_PARAMS,
  normalizeNeckParams,
  type NeckParams,
} from "@/lib/neck/params";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type * as THREE from "three";
import { renderModelPreview } from "@/lib/preview/model";
import { NUMERIC_NECK_META } from "../constants";
import {
  toNumericInputDraft,
  toTransformInputDraft,
  neckParamsToHeadstockTransforms,
  headstockTransformsToNeckPatch,
  clampHeadstockTransforms,
} from "../utils";

function toInputDraft(params: NeckParams): Record<NumericNeckKey, string> {
  return toNumericInputDraft(params);
}

export const createNeckSlice: StateCreator<FullStore, [], [], NeckSlice> = (
  set,
  get,
) => ({
  neckDraftByNodeId: {},
  neckInputDraftByNodeId: {},
  headstockLoadByNodeId: {},
  savingNeckNodeId: null,
  creatingNeck: false,

  getNeckParamsForNode: (node) => {
    if (node.asset?.part_type !== "neck") return null;
    const draft = get().neckDraftByNodeId[node.id];
    if (draft) return draft;
    const raw = (node.asset?.meta as { neck?: unknown } | null)?.neck;
    return raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;
  },

  getHeadstockTransformsForNode: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node || node.asset?.part_type !== "neck")
      return {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 1,
      };
    const params = get().getNeckParamsForNode(node) ?? DEFAULT_NECK_PARAMS;
    return neckParamsToHeadstockTransforms(params);
  },

  initNeckDraft: (node) => {
    const nodeId = node.id;
    const raw = (node.asset?.meta as { neck?: unknown } | null)?.neck;
    const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;

    set((state) => {
      const hasNeck = nodeId in state.neckDraftByNodeId;
      const hasInput = nodeId in state.neckInputDraftByNodeId;
      const hasHsTransform =
        nodeId in state.headstockTransformInputDraftByNodeId;
      if (hasNeck && hasInput && hasHsTransform) return {};
      return {
        ...(!hasNeck
          ? {
              neckDraftByNodeId: {
                ...state.neckDraftByNodeId,
                [nodeId]: params,
              },
            }
          : {}),
        ...(!hasInput
          ? {
              neckInputDraftByNodeId: {
                ...state.neckInputDraftByNodeId,
                [nodeId]: toInputDraft(params),
              },
            }
          : {}),
        ...(!hasHsTransform
          ? {
              headstockTransformInputDraftByNodeId: {
                ...state.headstockTransformInputDraftByNodeId,
                [nodeId]: toTransformInputDraft(
                  neckParamsToHeadstockTransforms(params),
                ),
              },
            }
          : {}),
      };
    });
  },

  updateNeckDraft: (nodeId, patch) =>
    set((state) => {
      const current = state.neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
      const next = normalizeNeckParams({ ...current, ...patch });
      return {
        neckDraftByNodeId: { ...state.neckDraftByNodeId, [nodeId]: next },
      };
    }),

  resetNeckDraft: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    const raw = (node?.asset?.meta as { neck?: unknown } | null)?.neck;
    const params = raw ? normalizeNeckParams(raw) : DEFAULT_NECK_PARAMS;

    set((state) => ({
      neckDraftByNodeId: { ...state.neckDraftByNodeId, [nodeId]: params },
      neckInputDraftByNodeId: {
        ...state.neckInputDraftByNodeId,
        [nodeId]: toInputDraft(params),
      },
      headstockTransformInputDraftByNodeId: {
        ...state.headstockTransformInputDraftByNodeId,
        [nodeId]: toTransformInputDraft(
          neckParamsToHeadstockTransforms(params),
        ),
      },
    }));
  },

  setNeckNumberInput: (nodeId, key, raw) =>
    set((state) => ({
      neckInputDraftByNodeId: {
        ...state.neckInputDraftByNodeId,
        [nodeId]: {
          ...(state.neckInputDraftByNodeId[nodeId] ?? {}),
          [key]: raw,
        },
      },
    })),

  commitNeckNumberInput: (nodeId, key) => {
    const raw = get().neckInputDraftByNodeId[nodeId]?.[key];
    const current = get().neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
    const currentValid = current[key] as number;

    if (!raw || raw.trim() === "" || !Number.isFinite(Number(raw))) {
      get().setNeckNumberInput(nodeId, key, String(currentValid));
      return;
    }

    const meta = NUMERIC_NECK_META[key];
    let next = Math.min(meta.max, Math.max(meta.min, Number(raw)));
    if (meta.integer) next = Math.round(next);

    const nextParams = normalizeNeckParams({ ...current, [key]: next });
    set((state) => ({
      neckDraftByNodeId: { ...state.neckDraftByNodeId, [nodeId]: nextParams },
      neckInputDraftByNodeId: {
        ...state.neckInputDraftByNodeId,
        [nodeId]: toInputDraft(nextParams),
      },
    }));
  },

  setHeadstockLoadState: (nodeId, next) =>
    set((state) => {
      const current = state.headstockLoadByNodeId[nodeId];
      if (
        current?.status === next.status &&
        (current?.message ?? null) === (next.message ?? null)
      )
        return {};
      return {
        headstockLoadByNodeId: {
          ...state.headstockLoadByNodeId,
          [nodeId]: { status: next.status, message: next.message ?? null },
        },
      };
    }),

  applyHeadstockTransformsToDraft: (nodeId, transforms) => {
    const clamped = clampHeadstockTransforms(transforms);
    const patch = headstockTransformsToNeckPatch(clamped);

    set((state) => {
      const current = state.neckDraftByNodeId[nodeId] ?? DEFAULT_NECK_PARAMS;
      const next = normalizeNeckParams({ ...current, ...patch });
      return {
        neckDraftByNodeId: { ...state.neckDraftByNodeId, [nodeId]: next },
        neckInputDraftByNodeId: {
          ...state.neckInputDraftByNodeId,
          [nodeId]: {
            ...(state.neckInputDraftByNodeId[nodeId] ?? {}),
            headstockOffsetXMm: String(patch.headstockOffsetXMm),
            headstockOffsetYMm: String(patch.headstockOffsetYMm),
            headstockOffsetZMm: String(patch.headstockOffsetZMm),
            headstockRotXDeg: String(patch.headstockRotXDeg),
            headstockRotYDeg: String(patch.headstockRotYDeg),
            headstockRotZDeg: String(patch.headstockRotZDeg),
            headstockScale: String(patch.headstockScale),
          },
        },
        headstockTransformInputDraftByNodeId: {
          ...state.headstockTransformInputDraftByNodeId,
          [nodeId]: {
            positionX: String(clamped.position.x),
            positionY: String(clamped.position.y),
            positionZ: String(clamped.position.z),
            rotationX: String(clamped.rotation.x),
            rotationY: String(clamped.rotation.y),
            rotationZ: String(clamped.rotation.z),
            scale: String(clamped.scale),
          },
        },
      };
    });
  },

  createParameterizedNeck: async () => {
    if (get().creatingNeck) return;
    set({ creatingNeck: true, errorMessage: null });

    try {
      const res = await fetch("/api/assets/neck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Parametric Neck" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !(payload as { assetId?: string })?.assetId) {
        throw new Error(
          (payload as { error?: string })?.error ?? "Failed to create neck",
        );
      }

      const createdNodeId = await get().addAssetToProject(
        (payload as { assetId: string }).assetId,
        "neck",
      );
      get().setActivePart("neck");

      if (createdNodeId) {
        set((state) => ({
          neckDraftByNodeId: state.neckDraftByNodeId[createdNodeId]
            ? state.neckDraftByNodeId
            : {
                ...state.neckDraftByNodeId,
                [createdNodeId]: DEFAULT_NECK_PARAMS,
              },
        }));
        get().setSelectedNodeId(createdNodeId);
      }

      window.dispatchEvent(new Event("assets-changed"));
    } catch (e) {
      set({
        errorMessage: e instanceof Error ? e.message : "Failed to create neck",
      });
    } finally {
      set({ creatingNeck: false });
    }
  },

  applyAndSaveNeck: async (node, group) => {
    if (!node.asset?.id) return;
    const draft = get().neckDraftByNodeId[node.id];
    if (!draft) return;

    if (!draft.headstockAssetId) {
      set({ errorMessage: "Please select a headstock asset." });
      return;
    }

    const headstockLoad = get().headstockLoadByNodeId[node.id];
    if (!headstockLoad || headstockLoad.status !== "ready") {
      set({
        errorMessage:
          headstockLoad?.status === "loading"
            ? "Headstock model is still loading."
            : (headstockLoad?.message ?? "Headstock model is not ready."),
      });
      return;
    }

    set({ savingNeckNodeId: node.id, errorMessage: null });

    try {
      const glbFile = await exportGroupToGlb(group);
      const previewBlob = await renderModelPreview(glbFile);

      const presignRes = await fetch("/api/assets/neck/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: node.asset.id }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok)
        throw new Error(
          (presign as { error?: string })?.error ?? "Neck presign failed",
        );

      await fetch(
        (presign as { model: { url: string; contentType: string } }).model.url,
        {
          method: "PUT",
          headers: { "Content-Type": presign.model.contentType },
          body: glbFile,
        },
      );
      await fetch(
        (presign as { preview: { url: string; contentType: string } }).preview
          .url,
        {
          method: "PUT",
          headers: { "Content-Type": presign.preview.contentType },
          body: previewBlob,
        },
      );

      const saveRes = await fetch("/api/assets/neck/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: node.asset.id,
          neckParams: draft,
          modelObjectKey: presign.model.objectKey,
          modelBytes: glbFile.size,
          previewObjectKey: presign.preview.objectKey,
          previewBytes: previewBlob.size,
        }),
      });
      const savePayload = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok)
        throw new Error(
          (savePayload as { error?: string })?.error ?? "Neck save failed",
        );

      await get().loadProjectData();
      window.dispatchEvent(new Event("assets-changed"));
    } catch (e) {
      set({
        errorMessage: e instanceof Error ? e.message : "Failed to save neck",
      });
    } finally {
      set({ savingNeckNodeId: null });
    }
  },

  clearNeckDraft: (nodeId) =>
    set((state) => {
      const nd = { ...state.neckDraftByNodeId };
      const ni = { ...state.neckInputDraftByNodeId };
      const hl = { ...state.headstockLoadByNodeId };
      delete nd[nodeId];
      delete ni[nodeId];
      delete hl[nodeId];
      return {
        neckDraftByNodeId: nd,
        neckInputDraftByNodeId: ni,
        headstockLoadByNodeId: hl,
      };
    }),
});

async function exportGroupToGlb(group: THREE.Group): Promise<File> {
  const exporter = new GLTFExporter();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (res) =>
        res instanceof ArrayBuffer
          ? resolve(res)
          : reject(new Error("GLB export failed")),
      (err) => reject(err),
      { binary: true },
    );
  });
  return new File([buffer], "generated-neck.glb", {
    type: "model/gltf-binary",
  });
}
