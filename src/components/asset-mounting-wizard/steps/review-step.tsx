"use client";

import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/fetch";
import { useWizard } from "@/components/asset-mounting-wizard/wizard-state";
import { axisAssignmentToFrameRotation } from "@/components/asset-mounting-wizard/helpers/axis-assignment";
import { Button } from "@/components/ui/button";
import type { GuitarMeta } from "@/lib/guitar/schema";
import type { WizardDraft } from "@/components/asset-mounting-wizard/wizard-state";

function buildGuitarMeta(partType: string, draft: WizardDraft): GuitarMeta {
  const frameRotation = axisAssignmentToFrameRotation({
    canonicalForward: draft.forwardAxis!,
    canonicalUp: draft.upAxis!,
  });

  switch (partType) {
    case "body":
      return { kind: "body", frameRotation, neckPocket: draft.neckPocket };
    case "bridge":
      return { kind: "bridge", frameRotation, saddleLine: draft.saddleLine };
    case "pickup":
      return {
        kind: "pickup",
        frameRotation,
        magneticCenter: draft.magneticCenter,
      };
    default:
      throw new Error(`Unsupported part type for mounting: ${partType}`);
  }
}

export function ReviewStep() {
  const { state, dispatch } = useWizard();
  const router = useRouter();
  const { draft, assetId, partType, userId, status, errorMessage } = state;

  const canSave =
    draft.forwardAxis !== null &&
    draft.upAxis !== null &&
    draft.forwardAxis[1] !== draft.upAxis[1];

  async function handleSave() {
    if (!canSave) return;

    dispatch({ type: "SAVE_START" });
    try {
      const guitar = buildGuitarMeta(partType, draft);
      await requestJson(
        "/api/assets/mounting",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, guitar }),
        },
        "Save failed",
      );
      dispatch({ type: "SAVE_SUCCESS" });
      router.push(`/library/${userId}`);
    } catch (e) {
      dispatch({
        type: "SAVE_ERROR",
        payload: e instanceof Error ? e.message : "Save failed",
      });
    }
  }

  let frameRotationSummary: string | null = null;
  if (canSave) {
    try {
      const r = axisAssignmentToFrameRotation({
        canonicalForward: draft.forwardAxis!,
        canonicalUp: draft.upAxis!,
      });
      frameRotationSummary = `x=${r.x.toFixed(1)}° y=${r.y.toFixed(1)}° z=${r.z.toFixed(1)}°`;
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Review & Save</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your orientation settings before saving.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Forward axis</dt>
        <dd className="font-mono">{draft.forwardAxis ?? "—"}</dd>
        <dt className="text-muted-foreground">Up axis</dt>
        <dd className="font-mono">{draft.upAxis ?? "—"}</dd>
        {frameRotationSummary && (
          <>
            <dt className="text-muted-foreground">Frame rotation</dt>
            <dd className="font-mono">{frameRotationSummary}</dd>
          </>
        )}
      </dl>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <Button
        onClick={() => void handleSave()}
        disabled={!canSave || status === "saving"}
        className="w-full"
      >
        {status === "saving" ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
