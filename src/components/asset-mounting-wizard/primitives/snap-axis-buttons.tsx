"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SignedAxis } from "@/components/asset-mounting-wizard/helpers/axis-assignment";

const AXES: SignedAxis[] = ["+x", "-x", "+y", "-y", "+z", "-z"];

type SnapAxisButtonsProps = {
  label: string;
  value: SignedAxis | null;
  onChange: (v: SignedAxis) => void;
  disabledAxes: string[];
};

export function SnapAxisButtons({
  label,
  value,
  onChange,
  disabledAxes,
}: SnapAxisButtonsProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2">
        {AXES.map((axis) => {
          const isDisabled = disabledAxes.includes(axis[1]);
          const isSelected = value === axis;
          return (
            <Button
              key={axis}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              disabled={isDisabled}
              onClick={() => onChange(axis)}
              className={cn(
                "w-10 font-mono",
                isSelected && "ring-2 ring-offset-1 ring-primary",
              )}
            >
              {axis}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
