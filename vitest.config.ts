import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/*.ts",
        "src/stores/project-playground/utils.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        // Route handlers — Next.js HTTP boundary, tested via E2E not unit tests
        "**/route.ts",
        // Preview pipeline — requires WebGL/OffscreenCanvas, not available in Node
        "src/lib/preview/**",
        // Supabase clients — require next/headers or browser APIs
        "src/lib/supabase/**",
        // NextResponse wrapper — requires Next.js runtime, not testable in Node
        "src/app/api/_shared/http.ts",
        // AWS SDK client init — reads credentials at module load, not testable in Node
        "src/lib/s3/client.ts",
        // Env validation — reads process.env at module load, not testable in Node
        "src/lib/env.ts",
      ],
    },
  },
});
