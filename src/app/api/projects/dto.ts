import { z } from "zod";

export const CreateProjectBodySchema = z.object({
  name: z.string().min(1).max(50),
  mode: z.enum(["blank", "import", "template"]).default("blank"),
  templateId: z.string().uuid().optional(),
  importAssetId: z.string().uuid().optional(),
});

export const DeleteProjectBodySchema = z.object({
  id: z.string().uuid(),
});

export const UpdateProjectPreviewBodySchema = z.object({
  projectId: z.string().uuid(),
  previewObjectKey: z.string().min(1),
  previewContentType: z.string().default("image/png"),
  previewBytes: z.number().int().nonnegative().nullable().optional(),
});

export const PresignProjectPreviewBodySchema = z.object({
  projectId: z.string().uuid(),
});
