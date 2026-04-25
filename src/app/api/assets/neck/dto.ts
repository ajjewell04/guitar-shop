import { z } from "zod";

export const CreateNeckBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
});

export const NeckPresignBodySchema = z.object({
  assetId: z.uuid(),
});

export const SaveNeckBodySchema = z.object({
  assetId: z.uuid(),
  neckParams: z.record(z.string(), z.unknown()),
  modelObjectKey: z.string().min(1),
  modelBytes: z.number().int().nonnegative().optional(),
  previewObjectKey: z.string().min(1),
  previewBytes: z.number().int().nonnegative().optional(),
});
