import js from "@eslint/js";
import json from "@eslint/json";
import css from "@eslint/css";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginNext from "@next/eslint-plugin-next";
import pluginPrettier from "eslint-plugin-prettier";
import configPrettier from "eslint-config-prettier/flat";
import pluginUnused from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/public/**",
    ".gitignore",
    ".prettierignore",
    ".stylelintignore",
    "stylelintrc.json",
    "package-lock.json",
    "README.md",
    "tsconfig.json",
    "*.css",
    "*.scss",
    "lint-staged.config.js",
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
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...pluginReact.configs.flat.recommended,
    rules: { "react/react-in-jsx-scope": "off" },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: { "unused-imports": pluginUnused },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
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
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...pluginNext.configs.recommended,
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    ...pluginNext.configs["core-web-vitals"],
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
