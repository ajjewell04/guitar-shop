import type { StateCreator } from "zustand";
import type { FullStore, NodesSlice } from "../slice-types";
import type {
  ProjectNode,
  ProjectNodesResponse,
  ProjectNodeDeleteResponse,
  PromoteProjectRootResponse,
} from "../types";
import {
  toPreviewNodes,
  saveProjectPreview,
} from "@/lib/project-preview-client";

export const createNodesSlice =
  (
    initialProjectId: string | undefined,
  ): StateCreator<FullStore, [], [], NodesSlice> =>
  (set, get) => {
    let previewFlushInFlight: Promise<void> | null = null;

    function findPartNode(rows: ProjectNode[], partType: string) {
      return rows.find((node) => node.asset?.part_type === partType) ?? null;
    }

    function getRequiredParentPartType(
      partType: string | null,
    ): "body" | "neck" | null {
      if (partType === "bridge" || partType === "pickup") return "body";
      if (partType === "tuning_machine") return "neck";
      return null;
    }

    async function promoteBodyNodeToRoot(bodyNodeId: string) {
      const projectId = get().projectId;
      if (!projectId) throw new Error("Missing project id");
      const res = await fetch("/api/projects/root", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, newRootNodeId: bodyNodeId }),
      });
      const payload = (await res
        .json()
        .catch(() => ({}))) as PromoteProjectRootResponse;
      if (!res.ok)
        throw new Error(
          payload?.error ?? "Failed to promote body to project root",
        );
    }

    async function ensureBodyNeckPairing(
      nextNodes: ProjectNode[],
    ): Promise<ProjectNode[]> {
      let currentNodes = nextNodes;
      let bodyNode = findPartNode(currentNodes, "body");
      let neckNode = findPartNode(currentNodes, "neck");

      if (!bodyNode || !neckNode) {
        get().setAssemblyWarnings([]);
        return currentNodes;
      }

      if (get().projectRootNodeId !== bodyNode.id) {
        await promoteBodyNodeToRoot(bodyNode.id);
        currentNodes = await get().loadProjectData(bodyNode.id);
        bodyNode = findPartNode(currentNodes, "body");
        neckNode = findPartNode(currentNodes, "neck");
        if (!bodyNode || !neckNode) return currentNodes;
      }

      if (neckNode.parent_id === bodyNode.id) {
        get().setAssemblyWarnings([]);
        return currentNodes;
      }

      await get().patchProjectNode(neckNode.id, { parentId: bodyNode.id });
      get().setAssemblyWarnings([]);
      return get().loadProjectData(neckNode.id);
    }

    async function loadFreshPreviewNodes(projectId: string) {
      const res = await fetch(`/api/projects/nodes?projectId=${projectId}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as ProjectNodesResponse;
      if (!res.ok)
        throw new Error(data?.error ?? "Failed to load nodes for preview");
      return toPreviewNodes(data.nodes ?? []);
    }

    return {
      projectId: initialProjectId,
      nodes: [],
      projectRootNodeId: null,
      libraryAssets: [],
      status: "idle",
      errorMessage: null,
      addingAssetId: null,
      deletingNodeId: null,

      setErrorMessage: (msg) => set({ errorMessage: msg }),

      flushProjectPreview: () => {
        if (previewFlushInFlight) return;
        const currentProjectId = get().projectId;
        if (!currentProjectId) return;

        previewFlushInFlight = (async () => {
          await get().flushPendingNodeSaves();
          let previewNodes = toPreviewNodes(get().nodes);
          try {
            previewNodes = await loadFreshPreviewNodes(currentProjectId);
          } catch {
            /* fall back to in-memory nodes */
          }
          if (!previewNodes.length) return;
          await saveProjectPreview(currentProjectId, previewNodes);
          window.dispatchEvent(new Event("projects-changed"));
        })()
          .catch(() => {
            /* best-effort */
          })
          .finally(() => {
            previewFlushInFlight = null;
          });
      },

      clearNodeDraft: (nodeId) => {
        get().clearTransformDraft(nodeId);
        get().clearNeckDraft(nodeId);
      },

      loadProjectData: async (preferredNodeId) => {
        const projectId = get().projectId;
        if (!projectId) {
          set({
            nodes: [],
            projectRootNodeId: null,
            libraryAssets: [],
            status: "idle",
          });
          get().setSelectedNodeId(null);
          return [];
        }

        set({ status: "loading", errorMessage: null });

        try {
          const res = await fetch(
            `/api/projects/nodes?projectId=${projectId}`,
            { cache: "no-store" },
          );
          const data = (await res.json()) as ProjectNodesResponse;
          if (!res.ok)
            throw new Error(data?.error ?? "Failed to load project nodes");

          const nextNodes = data.nodes ?? [];
          const rootNodeId = data.project?.root_node_id ?? null;

          set({
            nodes: nextNodes,
            projectRootNodeId: rootNodeId,
            libraryAssets: data.libraryAssets ?? [],
            status: "idle",
          });

          const { selectedNodeId } = get();
          if (
            preferredNodeId &&
            nextNodes.some((n) => n.id === preferredNodeId)
          ) {
            get().setSelectedNodeId(preferredNodeId);
          } else if (
            !selectedNodeId ||
            !nextNodes.some((n) => n.id === selectedNodeId)
          ) {
            get().setSelectedNodeId(
              nextNodes.length > 0 ? nextNodes[0].id : null,
            );
          }

          return nextNodes;
        } catch (err) {
          set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Load failed.",
          });
          return [];
        }
      },

      patchProjectNode: async (nodeId, patch) => {
        const res = await fetch("/api/projects/nodes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, ...patch }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string })?.error ?? "Project node update failed",
          );
        }
      },

      addAssetToProject: async (assetId, partTypeHint) => {
        const { projectId, libraryAssets, nodes } = get();
        if (!projectId) return null;

        const sourceAsset = libraryAssets.find((a) => a.id === assetId);
        const sourcePartType = sourceAsset?.part_type ?? partTypeHint ?? null;

        set({ addingAssetId: assetId, errorMessage: null });

        try {
          let resultNodeId: string | null = null;
          let nextNodes: ProjectNode[] = [];

          const isBodyOrNeck =
            sourcePartType === "body" || sourcePartType === "neck";
          const requiredParentPartType =
            getRequiredParentPartType(sourcePartType);
          const requiredParentNode = requiredParentPartType
            ? findPartNode(nodes, requiredParentPartType)
            : null;

          const createProjectNode = async (parentId?: string) => {
            const body: {
              projectId: string;
              assetId: string;
              parentId?: string;
            } = { projectId, assetId };
            if (parentId) body.parentId = parentId;
            const res = await fetch("/api/projects/nodes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
              throw new Error(
                (data as { error?: string })?.error ??
                  "Failed to add asset to project",
              );
            return typeof (data as { node?: { id?: string } })?.node?.id ===
              "string"
              ? (data as { node: { id: string } }).node.id
              : null;
          };

          if (isBodyOrNeck) {
            const existingNode = findPartNode(nodes, sourcePartType!);
            if (existingNode) {
              const confirmed = window.confirm(
                `This project already has a ${sourcePartType}. Replace it with "${sourceAsset?.name ?? "selected asset"}"?`,
              );
              if (!confirmed) return null;
              await get().patchProjectNode(existingNode.id, { assetId });
              get().clearNodeDraft(existingNode.id);
              resultNodeId = existingNode.id;
              nextNodes = await get().loadProjectData(existingNode.id);
            } else {
              resultNodeId = await createProjectNode();
              nextNodes = await get().loadProjectData(
                resultNodeId ?? undefined,
              );
            }
            nextNodes = await ensureBodyNeckPairing(nextNodes);
            const counterpart = sourcePartType === "body" ? "neck" : "body";
            if (!findPartNode(nextNodes, counterpart)) {
              get().showToast(
                `Added ${sourcePartType}. Add a ${counterpart} to auto-attach.`,
              );
            }
          } else if (sourcePartType === "bridge") {
            const existingBridgeNode = findPartNode(nodes, "bridge");
            if (existingBridgeNode) {
              const confirmed = window.confirm(
                `This project already has a bridge. Replace it with "${sourceAsset?.name ?? "selected asset"}"?`,
              );
              if (!confirmed) return null;
              await get().patchProjectNode(existingBridgeNode.id, { assetId });
              resultNodeId = existingBridgeNode.id;
              nextNodes = await get().loadProjectData(existingBridgeNode.id);
            } else {
              resultNodeId = await createProjectNode(requiredParentNode?.id);
              nextNodes = await get().loadProjectData(
                resultNodeId ?? undefined,
              );
              if (!requiredParentNode) {
                get().showToast(
                  "Added bridge without a body parent. Add a body to attach it.",
                );
              }
            }
          } else {
            resultNodeId = await createProjectNode(requiredParentNode?.id);
            nextNodes = await get().loadProjectData(resultNodeId ?? undefined);
            if (requiredParentPartType && !requiredParentNode) {
              const partLabel = sourcePartType?.replace(/_/g, " ") ?? "part";
              get().showToast(
                `Added ${partLabel} without a ${requiredParentPartType} parent. Add a ${requiredParentPartType} to attach it.`,
              );
            }
          }

          if (!resultNodeId) {
            const byAsset =
              nextNodes.find((n) => n.asset_id === assetId)?.id ?? null;
            if (byAsset) get().setSelectedNodeId(byAsset);
            return byAsset;
          }

          return resultNodeId;
        } catch (err) {
          set({
            errorMessage:
              err instanceof Error ? err.message : "Failed to add asset.",
            status: "error",
          });
          return null;
        } finally {
          set({ addingAssetId: null });
        }
      },

      deleteSelectedNode: async () => {
        const nodeId = get().selectedNodeId;
        if (!nodeId) return;

        set({ deletingNodeId: nodeId, errorMessage: null });

        try {
          await get().flushPendingNodeSaves();

          const res = await fetch("/api/projects/nodes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId }),
          });
          const payload = (await res
            .json()
            .catch(() => ({}))) as ProjectNodeDeleteResponse;

          if (!res.ok)
            throw new Error(
              payload?.error ?? "Failed to delete model from this project.",
            );

          if (typeof payload.deletedNodeId === "string") {
            get().clearNodeDraft(payload.deletedNodeId);
          }

          await get().loadProjectData();
          get().setSelectedNodeId(null);
        } catch (e) {
          set({
            errorMessage:
              e instanceof Error
                ? e.message
                : "Failed to delete selected model.",
            status: "error",
          });
        } finally {
          set({ deletingNodeId: null });
        }
      },
    };
  };
