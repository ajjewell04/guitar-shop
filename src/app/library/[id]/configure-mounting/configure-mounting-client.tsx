"use client";

import { WizardProvider } from "@/components/asset-mounting-wizard/wizard-state";
import { AssetMountingWizard } from "@/components/asset-mounting-wizard";
import type { GuitarMeta } from "@/lib/guitar/schema";

type ConfigureMountingClientProps = {
  assetId: string;
  partType: string;
  userId: string;
  modelUrl: string;
  existingMeta?: GuitarMeta;
};

export function ConfigureMountingClient({
  assetId,
  partType,
  userId,
  modelUrl,
  existingMeta,
}: ConfigureMountingClientProps) {
  return (
    <WizardProvider
      assetId={assetId}
      partType={partType}
      userId={userId}
      existingMeta={existingMeta}
    >
      <AssetMountingWizard modelUrl={modelUrl} />
    </WizardProvider>
  );
}
