"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type StepperProps = {
  steps: string[];
  currentIndex: number;
  onNext: () => void;
  onBack: () => void;
  canNext: boolean;
};

export function Stepper({
  steps,
  currentIndex,
  onNext,
  onBack,
  canNext,
}: StepperProps) {
  return (
    <div className="flex flex-col h-full">
      <ol className="flex flex-col gap-2 flex-1">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              i === currentIndex
                ? "bg-primary/10 font-semibold text-primary"
                : i < currentIndex
                  ? "text-muted-foreground"
                  : "text-muted-foreground/50",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                i === currentIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : i < currentIndex
                    ? "border-muted-foreground bg-muted-foreground text-background"
                    : "border-muted-foreground/30",
              )}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="flex gap-2 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={!canNext || currentIndex === steps.length - 1}
          className="flex-1"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
