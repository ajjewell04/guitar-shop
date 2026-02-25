import { z } from "zod";

export const GetModelsQuerySchema = z.object({
  projectId: z.uuid().optional(),
  view: z.enum(["library"]).optional(),
  ownerId: z.uuid().optional(),
});

export const DeleteModelBodySchema = z.object({
  assetId: z.uuid(),
});

export const PatchModelBodySchema = z.object({
  nodeId: z.uuid(),
  position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
});

export const CreateModelBodySchema = z.object({
  mode: z.enum(["template", "copy_to_library"]).optional(),
  templateKey: z.enum(["stratocaster", "telecaster", "les-paul"]).optional(),
  sourceAssetId: z.string().uuid().optional(),
});

export const ExportModelQuerySchema = z.object({
  projectId: z.uuid(),
});

export const ImportModelBodySchema = z.object({
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  assetName: z.string().min(1),
  partType: z.enum([
    "body",
    "neck",
    "headstock",
    "bridge",
    "tuning_machine",
    "pickup",
    "pickguard",
    "knob",
    "switch",
    "strap_button",
    "output_jack",
    "miscellaneous",
  ]),
  previewObjectKey: z.string().min(1),
  previewContentType: z.string().optional(),
  previewBytes: z.number().int().nonnegative().optional(),
});

export const PresignImportBodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().optional(),
});

export const UpdateModelPreviewBodySchema = z.object({
  assetId: z.string().uuid(),
  previewObjectKey: z.string().min(1),
  previewContentType: z.string().optional(),
  previewBytes: z.number().int().nonnegative().optional(),
});

export const PresignModelPreviewBodySchema = z.object({
  assetId: z.string().uuid(),
});
