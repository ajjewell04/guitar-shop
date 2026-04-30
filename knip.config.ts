import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: [
    // Loaded transitively via compat.extends("next/core-web-vitals", "next/typescript") in eslint.config.mjs.
    // FlatCompat resolves these at runtime; knip can't trace string-based extends.
    "eslint-config-next",
    "@next/eslint-plugin-next",
    "eslint-plugin-react",
    // CLI build tool — not imported in code, used by Vercel's build pipeline.
    "@tailwindcss/cli",
  ],
  // shadcn/ui components are a local component library; all exports are intentional.
  // database.types.ts is fully generated — unused-export noise is expected.
  ignore: ["src/components/ui/**", "src/types/database.types.ts"],
};

export default config;
