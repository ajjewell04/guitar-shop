import { z } from "zod";
import type { NeckParams } from "@/lib/neck-params";

export const MM_TO_WORLD = 0.001;

const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type Vec3 = z.infer<typeof Vec3Schema>;

export const JointTypeSchema = z.enum(["bolt_on", "set_neck", "neck_through"]);
export type JointType = z.infer<typeof JointTypeSchema>;

export const MountingAnchorSchema = z.object({
  positionMm: Vec3Schema,
  rotationDeg: Vec3Schema,
  scale: Vec3Schema,
});

export type MountingAnchor = z.infer<typeof MountingAnchorSchema>;

const MountingAnchorsSchema = z.object({
  neckPocket: MountingAnchorSchema.optional(),
  heel: MountingAnchorSchema.optional(),
});

export const AssetMountingSchema = z.object({
  jointType: JointTypeSchema.optional(),
  pocketWidthMm: z.number().positive().optional(),
  pocketLengthMm: z.number().positive().optional(),
  heelWidthMm: z.number().positive().optional(),
  heelLengthMm: z.number().positive().optional(),
  anchors: MountingAnchorsSchema.optional(),
});

export type AssetMounting = z.infer<typeof AssetMountingSchema>;

export const ImportMountingBodySchema = AssetMountingSchema.optional();

export type MountingCompatibilityWarning = {
  code: "joint_mismatch" | "width_mismatch" | "length_mismatch";
  message: string;
};

export const WIDTH_WARNING_TOLERANCE_MM = 0.5;
export const LENGTH_WARNING_TOLERANCE_MM = 1.0;

const DEFAULT_ANCHOR: MountingAnchor = {
  positionMm: { x: 0, y: 0, z: 0 },
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeAssetMounting(input: unknown): AssetMounting | null {
  if (!isRecord(input)) return null;
  const parsed = AssetMountingSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}

export function getAssetMountingFromMeta(meta: unknown): AssetMounting | null {
  if (!isRecord(meta)) return null;
  return normalizeAssetMounting(meta.mounting);
}

export function mergeMountingIntoMeta(
  meta: unknown,
  mounting: AssetMounting | null | undefined,
): Record<string, unknown> {
  const nextMeta: Record<string, unknown> = isRecord(meta) ? { ...meta } : {};
  if (!mounting) return nextMeta;
  nextMeta.mounting = mounting;
  return nextMeta;
}

export function getBodyNeckCompatibilityWarnings(
  bodyMounting: AssetMounting | null,
  neckMounting: AssetMounting | null,
): MountingCompatibilityWarning[] {
  const warnings: MountingCompatibilityWarning[] = [];

  if (!bodyMounting || !neckMounting) return warnings;

  if (
    bodyMounting.jointType &&
    neckMounting.jointType &&
    bodyMounting.jointType !== neckMounting.jointType
  ) {
    warnings.push({
      code: "joint_mismatch",
      message: `Joint mismatch: body ${bodyMounting.jointType.replace(/_/g, " ")} vs neck ${neckMounting.jointType.replace(/_/g, " ")}.`,
    });
  }

  if (
    typeof bodyMounting.pocketWidthMm === "number" &&
    typeof neckMounting.heelWidthMm === "number"
  ) {
    const diff = Math.abs(
      bodyMounting.pocketWidthMm - neckMounting.heelWidthMm,
    );
    if (diff > WIDTH_WARNING_TOLERANCE_MM) {
      warnings.push({
        code: "width_mismatch",
        message: `Width mismatch: pocket vs heel differs by ${diff.toFixed(2)}mm.`,
      });
    }
  }

  if (
    typeof bodyMounting.pocketLengthMm === "number" &&
    typeof neckMounting.heelLengthMm === "number"
  ) {
    const diff = Math.abs(
      bodyMounting.pocketLengthMm - neckMounting.heelLengthMm,
    );
    if (diff > LENGTH_WARNING_TOLERANCE_MM) {
      warnings.push({
        code: "length_mismatch",
        message: `Length mismatch: pocket vs heel differs by ${diff.toFixed(2)}mm.`,
      });
    }
  }

  return warnings;
}

export function getBodyNeckAnchors(
  bodyMounting: AssetMounting | null,
  neckMounting: AssetMounting | null,
): { bodyAnchor: MountingAnchor | null; neckAnchor: MountingAnchor | null } {
  return {
    bodyAnchor: bodyMounting?.anchors?.neckPocket ?? null,
    neckAnchor: neckMounting?.anchors?.heel ?? null,
  };
}

export function buildDefaultNeckMountingFromParams(
  params: NeckParams,
): AssetMounting {
  return {
    jointType: "bolt_on",
    heelWidthMm: params.heelWidthMm,
    heelLengthMm: params.heelLengthMm,
    anchors: { heel: DEFAULT_ANCHOR },
  };
}
