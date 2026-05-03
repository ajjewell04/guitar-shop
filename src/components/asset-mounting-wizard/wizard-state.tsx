"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { GuitarMeta } from "@/lib/guitar/schema";
import {
  wizardReducer,
  makeInitialState,
  type WizardState,
  type WizardAction,
} from "./wizard-reducer";

export type {
  SignedAxis,
  WizardDraft,
  WizardState,
  WizardAction,
} from "./wizard-reducer";

type WizardContextValue = {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
};

const WizardContext = createContext<WizardContextValue | null>(null);

type WizardProviderProps = {
  assetId: string;
  partType: string;
  userId: string;
  existingMeta?: GuitarMeta;
  children: ReactNode;
};

export function WizardProvider({
  assetId,
  partType,
  userId,
  existingMeta,
  children,
}: WizardProviderProps) {
  const [state, dispatch] = useReducer(
    wizardReducer,
    makeInitialState(assetId, partType, userId, existingMeta),
  );

  return (
    <WizardContext.Provider value={{ state, dispatch }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside WizardProvider");
  return ctx;
}
