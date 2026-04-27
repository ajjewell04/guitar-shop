import js from "@eslint/js";
import json from "@eslint/json";
import globals from "globals";
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pluginPrettier from "eslint-plugin-prettier";
import configPrettier from "eslint-config-prettier/flat";
import pluginUnused from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/public/**",
    "**/.claude/**",
    ".gitignore",
    ".prettierignore",
    ".stylelintignore",
    ".stylelintrc.json",
    "next-env.d.ts",
    "package-lock.json",
    "README.md",
    "tsconfig.json",
    "*.css",
    "*.scss",
    "lint-staged.config.js",
    "src/types/database.types.ts",
  ]),
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
    },
  },
  ...compat
    .extends("next/core-web-vitals", "next/typescript")
    .map((config) => ({
      ...config,
      files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    })),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { "unused-imports": pluginUnused },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    language: "json/jsonc",
    extends: ["json/recommended"],
  },
  configPrettier,
  {
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
    },
  },
]);
