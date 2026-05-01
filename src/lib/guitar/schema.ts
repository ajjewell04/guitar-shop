import { z } from "zod";

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vec3 = z.infer<typeof Vec3Schema>;

export const BodyGuitarMetaSchema = z.object({
  kind: z.literal("body"),
  frameRotation: Vec3Schema,
  neckPocket: z.object({
    origin: Vec3Schema,
    rotation: Vec3Schema,
  }),
});

export const BridgeGuitarMetaSchema = z.object({
  kind: z.literal("bridge"),
  frameRotation: Vec3Schema,
  saddleLine: z.object({
    bassEnd: Vec3Schema,
    trebleEnd: Vec3Schema,
  }),
});

export const PickupGuitarMetaSchema = z.object({
  kind: z.literal("pickup"),
  frameRotation: Vec3Schema,
  magneticCenter: Vec3Schema,
});

export const GuitarMetaSchema = z.discriminatedUnion("kind", [
  BodyGuitarMetaSchema,
  BridgeGuitarMetaSchema,
  PickupGuitarMetaSchema,
]);

export type GuitarMeta = z.infer<typeof GuitarMetaSchema>;
