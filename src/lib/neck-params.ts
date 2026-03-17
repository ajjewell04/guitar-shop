import { z } from "zod";

export const INCH_TO_MM = 25.4;

export const NeckProfileTypeSchema = z.enum(["C", "U", "V", "D"]);
export const FingerboardRadiusModeSchema = z.enum(["single", "compound"]);

export const NeckParamsSchema = z.object({
  scaleLengthIn: z.number().min(22.5).max(27).default(25.5),
  fretCount: z.number().int().min(20).max(24).default(22),

  nutWidthMm: z.number().min(38).max(48).default(42),
  widthAtLastFretMm: z.number().min(50).max(62).default(56),

  thicknessAt1stMm: z.number().min(18).max(25).default(21),
  thicknessAt12thMm: z.number().min(19).max(27).default(23),

  profileType: NeckProfileTypeSchema.default("C"),
  asymmetryMm: z.number().min(0).max(3).default(0),

  fingerboardRadiusMode: FingerboardRadiusModeSchema.default("single"),
  fingerboardRadiusStartIn: z.number().min(7.25).max(20).default(9.5),
  fingerboardRadiusEndIn: z.number().min(7.25).max(20).default(9.5),

  heelWidthMm: z.number().min(54).max(58.5).default(56),
  heelLengthMm: z.number().min(70).max(90).default(76),
  heelThicknessMm: z.number().min(20).max(28).default(25),
  heelCornerRadiusMm: z.number().min(0).max(12).default(6),

  tiltbackAngleDeg: z.number().min(0).max(17).default(0),
  neckAngleDeg: z.number().min(-2).max(5).default(0),

  headstockAssetId: z.uuid().nullable().default(null),
  headstockOffsetXMm: z.number().min(-500).max(500).default(0),
  headstockOffsetYMm: z.number().min(-500).max(500).default(0),
  headstockOffsetZMm: z.number().min(-500).max(500).default(0),
  headstockRotXDeg: z.number().min(-360).max(360).default(0),
  headstockRotYDeg: z.number().min(-360).max(360).default(0),
  headstockRotZDeg: z.number().min(-360).max(360).default(0),
  headstockScale: z.number().min(0.01).max(10).default(1),
});

export type NeckParams = z.infer<typeof NeckParamsSchema>;

export const DEFAULT_NECK_PARAMS: NeckParams = NeckParamsSchema.parse({});

export function normalizeNeckParams(input: unknown): NeckParams {
  const parsed = NeckParamsSchema.parse(input);
  if (parsed.fingerboardRadiusMode === "single") {
    parsed.fingerboardRadiusEndIn = parsed.fingerboardRadiusStartIn;
  }
  return parsed;
}
