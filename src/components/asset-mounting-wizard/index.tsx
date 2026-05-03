"use client";

import { useWizard } from "./wizard-state";
import { getFlow, STEP_LABELS } from "./flows";
import { Stepper } from "./primitives/stepper";
import { WizardViewport } from "./wizard-viewport";
import { OrientStep } from "./steps/orient-step";
import { ReviewStep } from "./steps/review-step";
import { sameAxis } from "./helpers/axis-assignment";

function ActiveStep({ stepId }: { stepId: string }) {
  switch (stepId) {
    case "orient":
      return <OrientStep />;
    case "review":
      return <ReviewStep />;
    default:
      return null;
  }
}

type AssetMountingWizardProps = {
  modelUrl: string;
};

export function AssetMountingWizard({ modelUrl }: AssetMountingWizardProps) {
  const { state, dispatch } = useWizard();
  const { partType, currentStepIndex, draft } = state;
  const steps = getFlow(partType);
  const currentStepId = steps[currentStepIndex] ?? "orient";

  const stepLabels = steps.map((id) => STEP_LABELS[id]);

  const orientValid =
    draft.forwardAxis !== null &&
    draft.upAxis !== null &&
    !sameAxis(draft.forwardAxis, draft.upAxis);

  // canNext: only meaningful on orient step; review step has its own Save button
  const canNext = currentStepId === "orient" ? orientValid : false;

  return (
    <div className="flex h-full min-h-0 gap-4 p-4">
      {/* Left rail — stepper */}
      <aside className="flex w-64 shrink-0 flex-col rounded-lg border bg-card p-4">
        <h1 className="mb-4 text-lg font-semibold">Configure Mounting</h1>
        <div className="mb-6 flex-1">
          <ActiveStep stepId={currentStepId} />
        </div>
        <Stepper
          steps={stepLabels}
          currentIndex={currentStepIndex}
          onNext={() => dispatch({ type: "NEXT_STEP" })}
          onBack={() => dispatch({ type: "PREV_STEP" })}
          canNext={canNext}
        />
      </aside>

      {/* Right — persistent 3D viewport */}
      <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
        <WizardViewport modelUrl={modelUrl} />
      </div>
    </div>
  );
}
