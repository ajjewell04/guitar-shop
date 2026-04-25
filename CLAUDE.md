# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Behavior

Always gather all available context before acting. If context is missing or ambiguous, do not assume — ask clarifying questions to fill the gap before proceeding.

## Commands

```bash
npm run dev          # start dev server (Next.js + Turbopack)
npm run build        # lint/stylecheck, then next build
npm run check        # stylelint + eslint only
npm run lint         # eslint only
npm run lint:styles  # stylelint only
npm run format       # prettier --write
npx vitest run       # run all tests (Node.js only — no DOM)
npx vitest run src/path/to/file.test.ts  # run a single test file
```

## Architecture

**Stack**: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth), AWS S3, React Three Fiber.

### Rendering boundary

Server components are the default. Add `"use client"` only at the lowest boundary where interactivity or browser APIs are required — never at the page level unless the entire page is interactive. Pass server-fetched data down as props to keep client bundles small.

### Data fetching

Fetch data in server components and pass it as props. TanStack Query is scoped to client-side **mutations and real-time updates only** — not for initial data loads that can be handled server-side.

### Auth & Session

Middleware at `src/middleware.ts` → `src/lib/middleware.ts` refreshes Supabase sessions on every request and redirects unauthenticated users to `/auth/login`.

Always use `supabaseServer()` from `src/lib/supabase.ts` as the single Supabase client factory. (`src/lib/server.ts` is a duplicate that should be removed.)

API routes authenticate via `requireUser(supabase)` from `src/app/api/_shared/auth.ts`. It returns `{ supabase, user }` on success or a `Response` (401) on failure — always guard with `instanceof Response`.

### API Route Structure

Each resource follows a flat three-file layout — no `handlers/` subdirectory:

```
src/app/api/<resource>/
  route.ts    — HTTP boundary only: authenticate, parse DTO, call service, return response
  dto.ts      — Zod schemas for all request/response shapes
  service.ts  — all business logic, DB queries, and S3 operations
  mappers.ts  — row → response shape (signs S3 URLs, etc.) — only when needed
```

`route.ts` must not contain DB queries or S3 calls directly. Shared HTTP helpers (`jsonOk`, `jsonError`) live in `src/app/api/_shared/http.ts`. Shared S3 helpers (`signGetFileUrl`, `signPutObjectUrl`, `deleteObjectsByBucket`) live in `src/app/api/_shared/s3.ts`.

### Database Schema (Supabase)

Key tables: `assets`, `asset_files`, `projects`, `project_nodes`.

- An `asset` represents a guitar part. It has one or more `asset_files` (variants: `original`, `preview`).
- A `project` has many `project_nodes`, each referencing an `asset` with a `transforms` JSON column `{ position, rotation, scale }`.
- `assets.meta` is a freeform JSON column used for parametric neck params (`meta.neck`), mounting data (`meta.mounting`), and provenance (`meta.source`).

### S3 Credentials

`src/lib/s3.ts` switches credential strategy at runtime:

- **Vercel** (`VERCEL=1`): OIDC via `AWS_ROLE_ARN`
- **Local**: `~/.aws` profiles via `AWS_PROFILE` env var

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`, `S3_BUCKET`, `AWS_REGION`, and either `AWS_ROLE_ARN` (Vercel) or `AWS_PROFILE` (local). These live in `.env.local`.

### Procedural Neck

`src/lib/procedural-neck.ts` generates a fully parametric guitar neck as Three.js `BufferGeometry` (core, fretboard, nut, frets). Parameters are defined and validated by `NeckParamsSchema` in `src/lib/neck-params.ts`. The exported `buildProceduralNeckMesh(params)` returns a `THREE.Group`. The React wrapper is `src/components/project-playground/procedural-neck-mesh.tsx`.

Parametric necks are stored in Supabase with `upload_status: null` and no S3 object key — the mesh is generated client-side from `assets.meta.neck` on load.

### Project Creation Flow

New projects are created via a strategy pattern in `src/components/projects/new-project/strategies/`:

- `blank` — empty project
- `template` — copies a built-in GLB from `TEMPLATE_S3_KEYS` in `src/app/api/assets/service.ts`
- `import` — user uploads a GLB via presign → upload → finalize at `/api/assets/import`

### Preview Generation

Project thumbnails are rendered client-side: Three.js scene → offscreen canvas → PNG blob → presign (`/api/projects/preview/presign`) → PUT to S3 → finalize (`/api/projects/preview`). Client helpers live in `src/lib/project-preview-client.ts`; the render logic is in `src/lib/project-preview.ts` (dynamically imported to keep it out of the initial bundle).

## Testing

Vitest is scoped to **Node.js only** — no DOM or browser environment. Test targets are service functions, lib utilities, mappers, and DTO schemas. Co-locate test files next to the code they test (`foo.test.ts` beside `foo.ts`).

## Git

Never run `git add`, `git commit`, or any command that modifies git state. The user manages all git operations.

## Coding Conventions

- `@/*` maps to `src/`
- `cn()` from `src/lib/utils.ts` for class merging
- `"use client"` only at the smallest necessary boundary — never at page level
- Shared UI primitives in `src/components/ui/`; reusable non-UI logic in `src/lib/`
- Avoid `any` — use `unknown` and narrow explicitly
- Catch errors as `unknown` and narrow before use
