import { describe, it, expect } from "vitest";
import {
  wizardReducer,
  makeInitialState,
  type WizardAction,
} from "./wizard-reducer";
import type { GuitarMeta } from "@/lib/guitar/schema";

const BASE = { assetId: "a1", partType: "body", userId: "u1" };

function init(existingMeta?: GuitarMeta) {
  return makeInitialState(
    BASE.assetId,
    BASE.partType,
    BASE.userId,
    existingMeta,
  );
}

function dispatch(state: ReturnType<typeof init>, action: WizardAction) {
  return wizardReducer(state, action);
}

describe("INIT", () => {
  it("zeroes axes and placeholders with no existing meta", () => {
    const s = init();
    expect(s.assetId).toBe("a1");
    expect(s.partType).toBe("body");
    expect(s.currentStepIndex).toBe(0);
    expect(s.status).toBe("idle");
    expect(s.draft.forwardAxis).toBeNull();
    expect(s.draft.upAxis).toBeNull();
    expect(s.draft.neckPocket).toEqual({
      origin: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });
  });

  it("infers axes and preserves neckPocket from existing body meta", () => {
    const existingMeta: GuitarMeta = {
      kind: "body",
      frameRotation: { x: 0, y: 0, z: 0 },
      neckPocket: {
        origin: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
      },
    };
    const s = init(existingMeta);
    expect(s.draft.forwardAxis).toBe("+z");
    expect(s.draft.upAxis).toBe("+y");
    expect(s.draft.neckPocket).toEqual({
      origin: { x: 1, y: 2, z: 3 },
      rotation: { x: 10, y: 20, z: 30 },
    });
  });
});

describe("SET_FORWARD_AXIS / SET_UP_AXIS", () => {
  it("updates forwardAxis", () => {
    const s = dispatch(init(), { type: "SET_FORWARD_AXIS", payload: "+x" });
    expect(s.draft.forwardAxis).toBe("+x");
  });

  it("updates upAxis", () => {
    const s = dispatch(init(), { type: "SET_UP_AXIS", payload: "-z" });
    expect(s.draft.upAxis).toBe("-z");
  });
});

describe("NEXT_STEP", () => {
  it("is blocked when axes are null", () => {
    const s = dispatch(init(), { type: "NEXT_STEP" });
    expect(s.currentStepIndex).toBe(0);
  });

  it("is blocked when axes are set but conflict (same axis)", () => {
    let s = init();
    s = dispatch(s, { type: "SET_FORWARD_AXIS", payload: "+x" });
    s = dispatch(s, { type: "SET_UP_AXIS", payload: "-x" });
    s = dispatch(s, { type: "NEXT_STEP" });
    expect(s.currentStepIndex).toBe(0);
  });

  it("advances when axes are valid", () => {
    let s = init();
    s = dispatch(s, { type: "SET_FORWARD_AXIS", payload: "+z" });
    s = dispatch(s, { type: "SET_UP_AXIS", payload: "+y" });
    s = dispatch(s, { type: "NEXT_STEP" });
    expect(s.currentStepIndex).toBe(1);
  });

  it("does not advance past last step", () => {
    let s = init();
    s = dispatch(s, { type: "SET_FORWARD_AXIS", payload: "+z" });
    s = dispatch(s, { type: "SET_UP_AXIS", payload: "+y" });
    s = dispatch(s, { type: "NEXT_STEP" }); // step 1
    s = dispatch(s, { type: "NEXT_STEP" }); // attempt step 2 (no step 2)
    expect(s.currentStepIndex).toBe(1);
  });
});

describe("PREV_STEP", () => {
  it("decrements step index", () => {
    let s = init();
    s = dispatch(s, { type: "SET_FORWARD_AXIS", payload: "+z" });
    s = dispatch(s, { type: "SET_UP_AXIS", payload: "+y" });
    s = dispatch(s, { type: "NEXT_STEP" });
    s = dispatch(s, { type: "PREV_STEP" });
    expect(s.currentStepIndex).toBe(0);
  });

  it("does not go below 0", () => {
    const s = dispatch(init(), { type: "PREV_STEP" });
    expect(s.currentStepIndex).toBe(0);
  });
});

describe("SET_DRAFT_FIELD", () => {
  it("merges partial fields into draft", () => {
    const s = dispatch(init(), {
      type: "SET_DRAFT_FIELD",
      payload: { forwardAxis: "+y" },
    });
    expect(s.draft.forwardAxis).toBe("+y");
    expect(s.draft.upAxis).toBeNull();
  });
});

describe("SAVE_* transitions", () => {
  it("SAVE_START → status=saving", () => {
    const s = dispatch(init(), { type: "SAVE_START" });
    expect(s.status).toBe("saving");
    expect(s.errorMessage).toBeNull();
  });

  it("SAVE_SUCCESS → status=success", () => {
    let s = dispatch(init(), { type: "SAVE_START" });
    s = dispatch(s, { type: "SAVE_SUCCESS" });
    expect(s.status).toBe("success");
  });

  it("SAVE_ERROR → status=error with message", () => {
    let s = dispatch(init(), { type: "SAVE_START" });
    s = dispatch(s, { type: "SAVE_ERROR", payload: "Network error" });
    expect(s.status).toBe("error");
    expect(s.errorMessage).toBe("Network error");
  });
});
