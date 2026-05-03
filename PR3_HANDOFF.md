# PR 3: Body Flow — Neck Pocket Capture + Orient-Step Viewport Fixes

This is the third PR of the asset-mounting wizard. It adds the body-specific step (capture the neck pocket's origin and rotation) and fixes a UX issue with the orient step's viewport that became apparent in user testing of PR 2.

## Context

The wizard chassis from PR 2 supports a single shared orient step plus a generic review/save step. PR 3 adds the first _part-type-specific_ step — neck pocket capture for body assets — and proves the click-on-mesh interaction pattern that the bridge and pickup flows in PR 4/5 will reuse.

Schema reminder: `BodyGuitarMetaSchema` in `src/lib/guitar/schema.ts` requires `neckPocket: { origin: Vec3, rotation: Vec3 }`. Both fields are full Vec3s — the wizard captures origin via a click, rotation via a combination of yaw (from a second click) and an explicit neck-angle (pitch) input. Roll defaults to zero — almost no real guitar has it.

## Orient-step viewport fixes (do these first)

User testing surfaced that the orient step's axis lines are confusing. Two changes to `src/components/asset-mounting-wizard/wizard-viewport.tsx`:

1. **Move the `<axesHelper>` inside the rotated `<group>`** so it co-rotates with the model. After this change, the red line is the model's local +X, etc. — which is exactly what the orient step asks the user to identify.
2. **Add tip labels** (`+X`, `+Y`, `+Z`) at the end of each axis line. Use `Text` from `@react-three/drei` with a small fontSize and a billboard so labels always face the camera. Color-match each label to its line.

A third improvement worth folding in: render the negative-half axes (`-X`, `-Y`, `-Z`) as muted, semi-transparent lines so the user can visually identify all six button options on their actual model. Same labels, lower opacity (e.g. 30%).

Color-code the snap-to-axis buttons to match: `+x`/`-x` get a red accent, `+y`/`-y` green, `+z`/`-z` blue. A 1px colored left border on each button is enough — don't make the buttons fully colored, that fights the dark theme. Update `src/components/asset-mounting-wizard/primitives/snap-axis-buttons.tsx` accordingly.

These changes are scoped tightly to the viewport and the snap-axis primitive; they don't touch wizard state, flows, or any other step.

## Body neck pocket step

Add a new step `mark-neck-pocket` that comes after `orient` and before `review` in the body flow. The step captures three things in sequence in a single panel (no further sub-stepping — keep it one logical step from the user's perspective):

**Phase 1 — origin click.** The user clicks anywhere on the rotated mesh. A surface raycast against the model returns a hit point in canonical-frame coordinates (after the frame rotation has been applied). A small marker (sphere) appears at the click point. Clicking again repositions it. Hold Shift to snap to the nearest mesh vertex instead of the raycast hit. The captured value is `draft.body.neckPocket.origin: Vec3`.

**Phase 2 — direction click.** Once an origin is set, the panel prompts: "Now click in the direction the neck extends." A second click captures a direction point. The wizard derives `rotationY` (yaw) from the XZ-plane angle between origin and direction — same math as the helper sketched in PR 1's brief. A small arrow renders from origin pointing in the captured direction so the user has visual confirmation. Re-clicking updates the direction.

**Phase 3 — neck angle slider.** A simple horizontal slider labeled "Neck angle" with range -10° to +10° and 0.1° step, defaulting to 0°. This captures `rotationX` (pitch / tilt-back). The marker arrow tilts in the viewport as the slider moves so the effect is visible. For most guitars this stays at or near zero; for Les Paul-style designs it lands around 4°.

`rotationZ` (roll) defaults to 0 and is not user-adjustable in this version. Document this in a code comment; it can be added as an advanced control later if needed.

The Next button is enabled only when both origin and direction have been captured. The neck-angle slider has a default of 0 and is always considered captured.

## Editing-existing flow

If the asset's `meta.guitar` already has a `neckPocket` populated, load it as the initial draft on wizard mount. The marker and arrow render at the saved origin/direction; the slider sits at the saved pitch. Users can adjust any of the three and re-save.

## Files to create

```
src/components/asset-mounting-wizard/
  steps/
    mark-neck-pocket-step.tsx         # the panel UI: prompts + slider + status
  primitives/
    click-marker-controller.tsx       # generic R3F component: handles surface raycast + vertex-snap modifier, fires onPick(point: Vec3)
    direction-arrow.tsx               # R3F arrow rendered from origin in given XZ direction with given pitch
    axes-helper-labeled.tsx           # replacement for <axesHelper> with tip labels and optional negative-axis rendering
  helpers/
    two-click-yaw.ts                  # pure: yaw from two Vec3 points (was twoClickToYawDeg in PR 1's brief)
    two-click-yaw.test.ts
```

## Files to modify

- `src/components/asset-mounting-wizard/wizard-viewport.tsx` — co-rotate axes with model; use the new labeled axes helper; add the click-marker-controller and direction-arrow renderers (controlled by current step + draft state).
- `src/components/asset-mounting-wizard/primitives/snap-axis-buttons.tsx` — color-coded accents per axis.
- `src/components/asset-mounting-wizard/wizard-reducer.ts` — add actions `SET_NECK_POCKET_ORIGIN`, `SET_NECK_POCKET_DIRECTION`, `SET_NECK_POCKET_PITCH`. Direction is stored separately from rotation; the reducer (or a derived selector) computes the final `rotation: Vec3` from yaw + pitch when the draft is read for save.
- `src/components/asset-mounting-wizard/wizard-state.tsx` — extend the draft type with `body.neckPocketCapture: { origin: Vec3 | null; directionPoint: Vec3 | null; pitchDeg: number }`. The save mapper converts this to `BodyGuitarMeta.neckPocket`.
- `src/components/asset-mounting-wizard/flows.ts` — body flow becomes `["orient", "mark-neck-pocket", "review"]`.
- `src/components/asset-mounting-wizard/index.tsx` — `ActiveStep` switch picks up the new step.
- `src/components/asset-mounting-wizard/steps/review-step.tsx` — render the captured neck pocket origin/rotation in the summary; ensure the save payload uses the converted `BodyGuitarMeta` shape.

## Key design decisions baked in

1. **One logical step, three phases.** Origin → direction → angle inside one panel. Keeps the user's mental model whole ("I'm placing the neck pocket"). The Next button only enables once origin and direction are set.
2. **Yaw via two-click; pitch via slider; roll forced to zero.** Matches how guitar builders actually think about neck pockets — string axis (yaw) + neck angle (pitch). Roll has no real-world analogue here.
3. **Surface raycast is the click default; Shift snaps to vertex.** Same as the PR 2 plan. Free-floating fallback (clicking off the mesh) just doesn't register a hit — the user has to click the mesh.
4. **Markers render in the rotated frame.** The model is in canonical frame after orientation; the marker, arrow, and any future visual annotations live in that same group so they move with the model when the user revisits orient.
5. **The reducer stores capture inputs, not the final rotation.** Keeping `directionPoint` and `pitchDeg` separately means re-rendering the arrow stays direct (no rotation→points back-conversion). The save mapper composes the final `rotation: Vec3` once on payload assembly.

## Tests to write

`two-click-yaw.test.ts` — same shape as the helper sketched in PR 1's brief: zero degenerate, +Z direction = 0°, +X direction = 90°, -X = -90°, -Z = ±180°, 45° diagonal, ignores Y, translation-invariant.

`wizard-reducer.test.ts` — extend with the three new actions: setting origin, setting direction, setting pitch. Verify draft is updated; verify Next-eligibility is computed correctly (false until origin and direction are both non-null).

`mark-neck-pocket-step.test.tsx` — light component test (using @testing-library/react if it's already in the project; skip otherwise): renders the prompt for phase 1 when origin is null, renders the direction prompt when origin is set, slider always present, Next disabled until both captures complete.

No 3D-interaction tests for the click controller or direction arrow — manual test notes belong in the PR description. Manual checklist:

- Open a body asset's wizard
- Walk through orient (verify axes co-rotate; verify labels visible; verify button color accents render)
- Click the body to drop the origin marker
- Hold Shift and click again to verify vertex snap
- Click again (without shift) to drop the direction; verify arrow renders
- Move the neck angle slider; verify arrow tilts
- Save; reopen; verify all three values round-trip and the marker/arrow/slider reflect the saved state

## What's NOT in scope for PR 3

- Bridge or pickup flows (PR 4, PR 5)
- Roll capture for the neck pocket (advanced control deferred indefinitely)
- Visual rendering of a "ghost neck" silhouette to confirm placement (nice-to-have; not blocking)
- Any resolver or playground render-path changes

## Conventions to mirror

- Same lint rules and file structure as PR 2.
- Pure-helper modules stay free of React/Three.js imports where possible. The two-click-yaw helper has no Three.js dependency — implement with `Math.atan2`.
- The new R3F primitives (`click-marker-controller`, `direction-arrow`, `axes-helper-labeled`) are pure presentational components that take their state as props; all wizard state flows through `useWizard()` at the parent level.
- Run `npm run check` and `npm run test` before declaring done.

## Open questions to flag during implementation

1. **Does the project already have a slider primitive in `src/components/ui/`?** If yes, use it for the neck-angle input. If no, add a minimal range input — don't pull in a third-party slider lib.
2. **Should the neck-angle slider show the current value as a text input next to it?** Recommended: yes, with two decimal places. Lets the user type a precise value (e.g. "4.00°" for a Les Paul) when the slider is too coarse.
3. **What's the camera framing strategy when the user enters the mark-neck-pocket step?** Default is to keep whatever orbit position the user left it at. Consider auto-framing top-down (camera above, looking at +Y → -Y) since neck-pocket placement is most natural from a top view. Decision can be deferred — leave as user-controlled for now.
