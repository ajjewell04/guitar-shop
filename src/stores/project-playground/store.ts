"use client";

import { createStore, useStore } from "zustand";
import { createContext, useContext } from "react";
import type { StoreApi } from "zustand";
import { createUISlice } from "./slices/ui";
import { createNodesSlice } from "./slices/nodes";
import { createTransformsSlice } from "./slices/transforms";
import { createNeckSlice } from "./slices/neck";
import type { FullStore } from "./slice-types";

export type { FullStore };

export function createProjectPlaygroundStore(projectId: string | undefined) {
  return createStore<FullStore>()((...args) => ({
    ...createUISlice(...args),
    ...createNodesSlice(projectId)(...args),
    ...createTransformsSlice(...args),
    ...createNeckSlice(...args),
  }));
}

export type ProjectPlaygroundStoreApi = StoreApi<FullStore>;

export const ProjectPlaygroundStoreContext =
  createContext<ProjectPlaygroundStoreApi | null>(null);

export function useProjectPlaygroundStore<T>(
  selector: (state: FullStore) => T,
): T {
  const store = useContext(ProjectPlaygroundStoreContext);
  if (!store) throw new Error("Missing ProjectPlaygroundStoreContext.Provider");
  return useStore(store, selector);
}
