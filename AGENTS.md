# AGENTS.md

Primary instruction file for OpenCode and coding agents in this repository.

## Scope

- This file is the source of truth for agent behavior in this repo.
- Add nested agent files only when a subdirectory needs different rules.

## Repo Context

- Next.js 15 app router project with TypeScript.
- Tailwind CSS v4, ESLint, Stylelint, Prettier, Husky, and lint-staged are used.
- Supabase, AWS S3, and middleware support auth and asset access.
- Most application code lives under `src/`.

## Before You Code

- Inspect the repo first; do not guess when the codebase can answer the question.
- Prefer existing patterns over new abstractions.
- Make the smallest safe change that solves the task.
- If the request is ambiguous in a way that changes behavior, ask one focused question.

## Decision Rules

- Proceed without asking for routine implementation choices.
- Ask before destructive, irreversible, or security-sensitive changes.
- Ask before changing auth, data flow, environment variables, or production behavior.
- Never commit unless the user explicitly asks.
- Never overwrite user changes you did not make.

## Coding Rules

- Use TypeScript strictly; avoid `any`.
- Use `@/*` imports for code under `src/`.
- Keep server components server-side by default.
- Put `"use client";` only where needed.
- Prefer Tailwind utilities in component markup.
- Use `cn()` from `src/lib/utils.ts` for class merging.
- Keep shared UI in `src/components/ui/`.
- Keep utility code in `src/lib/`.

## Verification

- Prefer file-scoped checks first.
- Use `eslint`, `stylelint`, and `prettier` on only the files you changed when possible.
- Run `npm run build` before finishing meaningful changes.
- If build fails, fix the issue before wrapping up.

## Error Handling

- Catch errors as `unknown` and narrow them.
- Return user-facing messages instead of raw exceptions.
- Avoid debug logging unless it is intentional.

## Response Format

- Be concise and factual.
- Reference changed files with paths.
- Mention what was verified and what was not.
- Call out any assumptions or blocked decisions.

## Notes

- No test runner is configured yet.
- Add new rules here only if they should apply broadly across the repo.
