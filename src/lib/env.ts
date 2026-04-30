import { z } from "zod";

const envSchema = z.object({
  S3_BUCKET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  VERCEL: z.string().optional(),
  AWS_ROLE_ARN: z.string().optional(),
  AWS_PROFILE: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
});

// next build imports route modules without runtime env vars present.
// Validation runs at server start; skip here to allow the build to succeed.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  envSchema.parse(process.env);
}

export const env = process.env as unknown as z.infer<typeof envSchema>;
