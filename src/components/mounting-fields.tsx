"use client";

import type { PartType } from "@/components/new-project/constants";
import {
  getJointTypeAutofillPatch,
  type MountingFormDraft,
} from "@/lib/mounting-form";
import { cn } from "@/lib/utils";

type MountingFieldsProps = {
  partType: PartType | "";
  draft: MountingFormDraft;
  onDraftChange: (patch: Partial<MountingFormDraft>) => void;
  className?: string;
};

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 0.1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="text-xs">
      {label}
      <input
        className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function MountingFields({
  partType,
  draft,
  onDraftChange,
  className,
}: MountingFieldsProps) {
  if (partType !== "body" && partType !== "neck") return null;

  return (
    <section className={cn("rounded border border-white/10 p-3", className)}>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Mounting (Optional)
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs">
          Joint Type
          <select
            className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
            value={draft.jointType}
            onChange={(e) =>
              onDraftChange(
                getJointTypeAutofillPatch(
                  partType,
                  e.target.value as MountingFormDraft["jointType"],
                ),
              )
            }
          >
            <option value="">Unspecified</option>
            <option value="bolt_on">Bolt-on</option>
            <option value="set_neck">Set neck</option>
            <option value="neck_through">Neck through</option>
          </select>
        </label>

        {partType === "body" ? (
          <>
            <NumberField
              label="Pocket Width (mm)"
              value={draft.pocketWidthMm}
              min={0}
              onChange={(value) => onDraftChange({ pocketWidthMm: value })}
            />
            <NumberField
              label="Pocket Length (mm)"
              value={draft.pocketLengthMm}
              min={0}
              onChange={(value) => onDraftChange({ pocketLengthMm: value })}
            />
          </>
        ) : (
          <>
            <NumberField
              label="Heel Width (mm)"
              value={draft.heelWidthMm}
              min={0}
              onChange={(value) => onDraftChange({ heelWidthMm: value })}
            />
            <NumberField
              label="Heel Length (mm)"
              value={draft.heelLengthMm}
              min={0}
              onChange={(value) => onDraftChange({ heelLengthMm: value })}
            />
          </>
        )}
      </div>

      <div className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        {partType === "body" ? "Neck Pocket Anchor" : "Heel Anchor"}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumberField
          label="Pos X (mm)"
          value={draft.anchorPositionXmm}
          onChange={(value) => onDraftChange({ anchorPositionXmm: value })}
        />
        <NumberField
          label="Pos Y (mm)"
          value={draft.anchorPositionYmm}
          onChange={(value) => onDraftChange({ anchorPositionYmm: value })}
        />
        <NumberField
          label="Pos Z (mm)"
          value={draft.anchorPositionZmm}
          onChange={(value) => onDraftChange({ anchorPositionZmm: value })}
        />
        <NumberField
          label="Rot X (deg)"
          value={draft.anchorRotationXDeg}
          onChange={(value) => onDraftChange({ anchorRotationXDeg: value })}
        />
        <NumberField
          label="Rot Y (deg)"
          value={draft.anchorRotationYDeg}
          onChange={(value) => onDraftChange({ anchorRotationYDeg: value })}
        />
        <NumberField
          label="Rot Z (deg)"
          value={draft.anchorRotationZDeg}
          onChange={(value) => onDraftChange({ anchorRotationZDeg: value })}
        />
        <NumberField
          label="Scale X"
          value={draft.anchorScaleX}
          step={0.01}
          onChange={(value) => onDraftChange({ anchorScaleX: value })}
        />
        <NumberField
          label="Scale Y"
          value={draft.anchorScaleY}
          step={0.01}
          onChange={(value) => onDraftChange({ anchorScaleY: value })}
        />
        <NumberField
          label="Scale Z"
          value={draft.anchorScaleZ}
          step={0.01}
          onChange={(value) => onDraftChange({ anchorScaleZ: value })}
        />
      </div>
    </section>
  );
}
