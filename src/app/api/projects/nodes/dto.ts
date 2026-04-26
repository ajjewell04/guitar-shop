import { z } from "zod";

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const GetProjectNodesQuerySchema = z.object({
  projectId: z.uuid(),
});

export const CreateProjectNodeBodySchema = z.object({
  projectId: z.uuid(),
  assetId: z.uuid(),
  parentId: z.uuid().nullable().optional(),
});

export const PatchProjectNodeBodySchema = z
  .object({
    nodeId: z.uuid(),
    position: PositionSchema.optional(),
    rotation: PositionSchema.optional(),
    scale: z.number().min(0.01).max(10).optional(),
    parentId: z.uuid().nullable().optional(),
    assetId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      value.position !== undefined ||
      value.rotation !== undefined ||
      value.scale !== undefined ||
      value.parentId !== undefined ||
      value.assetId !== undefined,
    {
      message:
        "At least one transform, parentId, or assetId field is required.",
      path: ["position"],
    },
  );

export const DeleteProjectNodeBodySchema = z.object({
  nodeId: z.uuid(),
});
