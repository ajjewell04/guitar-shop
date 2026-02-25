import { z } from "zod";

export const GetProjectNodesQuerySchema = z.object({
  projectId: z.uuid(),
});

export const CreateProjectNodeBodySchema = z.object({
  projectId: z.uuid(),
  assetId: z.uuid(),
  parentId: z.uuid().nullable().optional(),
});

export const PatchProjectNodeBodySchema = z.object({
  nodeId: z.uuid(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
});

export type GetProjectNodesQueryDto = z.infer<
  typeof GetProjectNodesQuerySchema
>;
export type CreateProjectNodeBodyDto = z.infer<
  typeof CreateProjectNodeBodySchema
>;
export type PatchProjectNodeBodyDto = z.infer<
  typeof PatchProjectNodeBodySchema
>;
