import { z } from "zod";

export const CreateProjectBodySchema = z.object({
  name: z.string().min(1).max(50),
  mode: z.enum(["blank", "import", "template"]).default("blank"),
  templateId: z.uuid().optional(),
  importAssetId: z.uuid().optional(),
});

export const DeleteProjectBodySchema = z.object({
  id: z.uuid(),
});

export const UpdateProjectPreviewBodySchema = z.object({
  projectId: z.uuid(),
  previewObjectKey: z.string().min(1),
  previewContentType: z.string().default("image/png"),
  previewBytes: z.number().int().nonnegative().nullable().optional(),
});

export const PresignProjectPreviewBodySchema = z.object({
  projectId: z.uuid(),
});
