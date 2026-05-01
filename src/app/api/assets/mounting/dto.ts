import { z } from "zod";
import { GuitarMetaSchema } from "@/lib/guitar/schema";

export const SaveMountingBodySchema = z.object({
  assetId: z.uuid(),
  guitar: GuitarMetaSchema,
});

export type SaveMountingBody = z.infer<typeof SaveMountingBodySchema>;
