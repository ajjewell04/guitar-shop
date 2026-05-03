"use client";

import { useWizard } from "@/components/asset-mounting-wizard/wizard-state";
import { sameAxis } from "@/components/asset-mounting-wizard/helpers/axis-assignment";
import { SnapAxisButtons } from "@/components/asset-mounting-wizard/primitives/snap-axis-buttons";
import type { SignedAxis } from "@/components/asset-mounting-wizard/helpers/axis-assignment";

export function OrientStep() {
  const { state, dispatch } = useWizard();
  const { forwardAxis, upAxis } = state.draft;

  const conflict =
    forwardAxis !== null && upAxis !== null && sameAxis(forwardAxis, upAxis);

  const forwardDisabledAxes = upAxis ? [upAxis[1]] : [];
  const upDisabledAxes = forwardAxis ? [forwardAxis[1]] : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold">Orient the model</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which axis of your model points <strong>Forward</strong> (+Z in
          canonical space) and which points <strong>Up</strong> (+Y). Right is
          derived automatically.
        </p>
      </div>

      <SnapAxisButtons
        label="Forward (+Z canonical)"
        value={forwardAxis}
        onChange={(v: SignedAxis) =>
          dispatch({ type: "SET_FORWARD_AXIS", payload: v })
        }
        disabledAxes={forwardDisabledAxes}
      />

      <SnapAxisButtons
        label="Up (+Y canonical)"
        value={upAxis}
        onChange={(v: SignedAxis) =>
          dispatch({ type: "SET_UP_AXIS", payload: v })
        }
        disabledAxes={upDisabledAxes}
      />

      {conflict && (
        <p className="text-sm text-destructive">
          Forward and Up cannot share an axis. Select a different axis for one
          of them.
        </p>
      )}

      {!conflict && forwardAxis && upAxis && (
        <p className="text-sm text-muted-foreground">
          Model <strong>{forwardAxis}</strong> → canonical Forward &nbsp;·&nbsp;
          Model <strong>{upAxis}</strong> → canonical Up
        </p>
      )}
    </div>
  );
}
