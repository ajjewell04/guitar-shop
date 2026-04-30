import { z } from "zod";

const envSchema = z.object({
  S3_BUCKET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  VERCEL: z.string().optional(),
  AWS_ROLE_ARN: z.string().optional(),
  AWS_PROFILE: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

export const env = envSchema.parse(process.env);
