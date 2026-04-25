"use client";

import { cn } from "@/lib/utils";
import { useProjectPlaygroundStore } from "@/stores/project-playground/store";
import {
  TRANSFORM_FIELDS,
  TRANSFORM_FIELDS_BY_MODE,
} from "@/stores/project-playground/constants";
import { toTransformInputDraft } from "@/stores/project-playground/utils";
import type {
  TransformMode,
  NeckTransformTarget,
} from "@/stores/project-playground/types";

type TransformSectionProps = {
  nodeId: string;
  mode: TransformMode;
  target?: NeckTransformTarget;
  className?: string;
};

export function TransformSection({
  nodeId,
  mode,
  target = "neck",
  className,
}: TransformSectionProps) {
  const isHs = target === "headstock";

  const transformInputDraftByNodeId = useProjectPlaygroundStore(
    (s) => s.transformInputDraftByNodeId,
  );
  const headstockTransformInputDraftByNodeId = useProjectPlaygroundStore(
    (s) => s.headstockTransformInputDraftByNodeId,
  );
  const getNodeTransformsById = useProjectPlaygroundStore(
    (s) => s.getNodeTransformsById,
  );
  const getHeadstockTransformsForNode = useProjectPlaygroundStore(
    (s) => s.getHeadstockTransformsForNode,
  );
  const setTransformInputValue = useProjectPlaygroundStore(
    (s) => s.setTransformInputValue,
  );
  const setHeadstockTransformInputValue = useProjectPlaygroundStore(
    (s) => s.setHeadstockTransformInputValue,
  );
  const commitTransformInput = useProjectPlaygroundStore(
    (s) => s.commitTransformInput,
  );
  const commitHeadstockTransformInput = useProjectPlaygroundStore(
    (s) => s.commitHeadstockTransformInput,
  );
  const scheduleTransformSave = useProjectPlaygroundStore(
    (s) => s.scheduleTransformSave,
  );
  const applyHeadstockTransformsToDraft = useProjectPlaygroundStore(
    (s) => s.applyHeadstockTransformsToDraft,
  );

  const draft = isHs
    ? (headstockTransformInputDraftByNodeId[nodeId] ??
      toTransformInputDraft(getHeadstockTransformsForNode(nodeId)))
    : (transformInputDraftByNodeId[nodeId] ??
      toTransformInputDraft(getNodeTransformsById(nodeId)));

  const fields = TRANSFORM_FIELDS.filter((f) =>
    TRANSFORM_FIELDS_BY_MODE[mode].includes(f.key),
  );
  const isAxis = mode !== "scale";

  function getCurrent() {
    return isHs
      ? getHeadstockTransformsForNode(nodeId)
      : getNodeTransformsById(nodeId);
  }

  function applyParsed(key: (typeof fields)[number]["key"], parsed: number) {
    const current = getCurrent();
    const k = key;
    const next =
      k === "positionX"
        ? { ...current, position: { ...current.position, x: parsed } }
        : k === "positionY"
          ? { ...current, position: { ...current.position, y: parsed } }
          : k === "positionZ"
            ? { ...current, position: { ...current.position, z: parsed } }
            : k === "rotationX"
              ? { ...current, rotation: { ...current.rotation, x: parsed } }
              : k === "rotationY"
                ? { ...current, rotation: { ...current.rotation, y: parsed } }
                : k === "rotationZ"
                  ? { ...current, rotation: { ...current.rotation, z: parsed } }
                  : { ...current, scale: parsed };
    if (isHs) applyHeadstockTransformsToDraft(nodeId, next);
    else scheduleTransformSave(nodeId, next);
  }

  return (
    <section
      className={cn(
        "rounded border border-white/10 bg-black/10 p-2",
        className,
      )}
    >
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {mode === "translate"
          ? "Position"
          : mode === "rotate"
            ? "Rotation"
            : "Scale"}
      </div>
      <div className={cn("text-xs", isAxis ? "flex gap-2" : "grid gap-2")}>
        {fields.map((field) => (
          <label
            key={field.key}
            className={cn(
              isAxis ? "min-w-0 flex-1" : "",
              field.key === "scale" ? "col-span-2" : "",
            )}
          >
            {isAxis
              ? field.key.endsWith("X")
                ? "X"
                : field.key.endsWith("Y")
                  ? "Y"
                  : "Z"
              : field.label}
            <input
              className="mt-1 w-full rounded border border-white/20 bg-[#0f1616] px-2 py-1"
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={draft[field.key]}
              onChange={(e) => {
                const raw = e.target.value;
                if (isHs)
                  setHeadstockTransformInputValue(nodeId, field.key, raw);
                else setTransformInputValue(nodeId, field.key, raw);
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return;
                applyParsed(field.key, parsed);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (isHs) commitHeadstockTransformInput(nodeId, field.key);
                else commitTransformInput(nodeId, field.key);
              }}
              onBlur={() => {
                if (isHs) commitHeadstockTransformInput(nodeId, field.key);
                else commitTransformInput(nodeId, field.key);
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
