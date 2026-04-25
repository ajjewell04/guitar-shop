import { z } from "zod";

export const GetAssetsQuerySchema = z.object({
  ownerId: z.uuid().optional(),
});

export const DeleteAssetBodySchema = z.object({
  assetId: z.uuid(),
});

export const CreateAssetBodySchema = z.object({
  mode: z.enum(["template", "copy_to_library"]).optional(),
  templateKey: z.enum(["stratocaster", "telecaster", "les-paul"]).optional(),
  sourceAssetId: z.uuid().optional(),
});

export const ExportAssetQuerySchema = z.object({
  projectId: z.uuid(),
});

export const ImportAssetBodySchema = z.object({
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

export const UpdateAssetPreviewBodySchema = z.object({
  assetId: z.uuid(),
  previewObjectKey: z.string().min(1),
  previewContentType: z.string().optional(),
  previewBytes: z.number().int().nonnegative().optional(),
});

export const PresignAssetPreviewBodySchema = z.object({
  assetId: z.uuid(),
});
