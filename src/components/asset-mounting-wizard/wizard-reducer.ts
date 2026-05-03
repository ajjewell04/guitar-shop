import { invertFrameTransform } from "@/lib/guitar/frame-transform";
import type { GuitarMeta, Vec3 } from "@/lib/guitar/schema";
import { getFlow, type StepId } from "./flows";
import { sameAxis, type SignedAxis } from "./helpers/axis-assignment";

export type { SignedAxis };

export type WizardDraft = {
  forwardAxis: SignedAxis | null;
  upAxis: SignedAxis | null;
  // Zero-initialized placeholders updated by PR 3/4/5 steps
  neckPocket: { origin: Vec3; rotation: Vec3 };
  saddleLine: { bassEnd: Vec3; trebleEnd: Vec3 };
  magneticCenter: Vec3;
};

export type WizardState = {
  assetId: string;
  partType: string;
  userId: string;
  currentStepIndex: number;
  draft: WizardDraft;
  status: "idle" | "saving" | "success" | "error";
  errorMessage: string | null;
};

export type WizardAction =
  | {
      type: "INIT";
      payload: {
        assetId: string;
        partType: string;
        userId: string;
        existingMeta?: GuitarMeta;
      };
    }
  | { type: "SET_FORWARD_AXIS"; payload: SignedAxis }
  | { type: "SET_UP_AXIS"; payload: SignedAxis }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_DRAFT_FIELD"; payload: Partial<WizardDraft> }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; payload: string };

const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

function zeroDraft(): WizardDraft {
  return {
    forwardAxis: null,
    upAxis: null,
    neckPocket: { origin: ZERO_VEC3, rotation: ZERO_VEC3 },
    saddleLine: { bassEnd: ZERO_VEC3, trebleEnd: ZERO_VEC3 },
    magneticCenter: ZERO_VEC3,
  };
}

function vecToSignedAxis(v: Vec3): SignedAxis | null {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  const max = Math.max(ax, ay, az);
  if (max < 0.99) return null;
  if (ax >= max) return v.x > 0 ? "+x" : "-x";
  if (ay >= max) return v.y > 0 ? "+y" : "-y";
  return v.z > 0 ? "+z" : "-z";
}

export function makeInitialState(
  assetId: string,
  partType: string,
  userId: string,
  existingMeta?: GuitarMeta,
): WizardState {
  const draft = zeroDraft();

  if (existingMeta) {
    const fr = existingMeta.frameRotation;
    draft.forwardAxis = vecToSignedAxis(
      invertFrameTransform({ x: 0, y: 0, z: 1 }, fr),
    );
    draft.upAxis = vecToSignedAxis(
      invertFrameTransform({ x: 0, y: 1, z: 0 }, fr),
    );

    if (existingMeta.kind === "body") {
      draft.neckPocket = existingMeta.neckPocket;
    } else if (existingMeta.kind === "bridge") {
      draft.saddleLine = existingMeta.saddleLine;
    } else if (existingMeta.kind === "pickup") {
      draft.magneticCenter = existingMeta.magneticCenter;
    }
  }

  return {
    assetId,
    partType,
    userId,
    currentStepIndex: 0,
    draft,
    status: "idle",
    errorMessage: null,
  };
}

function orientStepValid(draft: WizardDraft): boolean {
  return (
    draft.forwardAxis !== null &&
    draft.upAxis !== null &&
    !sameAxis(draft.forwardAxis, draft.upAxis)
  );
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case "INIT":
      return makeInitialState(
        action.payload.assetId,
        action.payload.partType,
        action.payload.userId,
        action.payload.existingMeta,
      );

    case "SET_FORWARD_AXIS":
      return {
        ...state,
        draft: { ...state.draft, forwardAxis: action.payload },
      };

    case "SET_UP_AXIS":
      return {
        ...state,
        draft: { ...state.draft, upAxis: action.payload },
      };

    case "NEXT_STEP": {
      const steps: StepId[] = getFlow(state.partType);
      const currentStep = steps[state.currentStepIndex];

      if (currentStep === "orient" && !orientStepValid(state.draft)) {
        return state;
      }

      if (state.currentStepIndex < steps.length - 1) {
        return { ...state, currentStepIndex: state.currentStepIndex + 1 };
      }
      return state;
    }

    case "PREV_STEP":
      if (state.currentStepIndex > 0) {
        return { ...state, currentStepIndex: state.currentStepIndex - 1 };
      }
      return state;

    case "SET_DRAFT_FIELD":
      return { ...state, draft: { ...state.draft, ...action.payload } };

    case "SAVE_START":
      return { ...state, status: "saving", errorMessage: null };

    case "SAVE_SUCCESS":
      return { ...state, status: "success" };

    case "SAVE_ERROR":
      return { ...state, status: "error", errorMessage: action.payload };

    default:
      return state;
  }
}
