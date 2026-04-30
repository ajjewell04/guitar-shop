# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Behavior

Always gather all relevant context before acting. If context is missing or ambiguous, do not assume — ask clarifying questions to fill the gap before proceeding.

## Commands

```bash
npm run dev           # start dev server (Next.js + Turbopack)
npm run build         # lint/stylecheck, then next build
npm run check         # stylelint + eslint only (no fix)
npm run lint          # eslint only (no fix)
npm run lint:styles   # stylelint only
npm run format        # prettier --write (entire project)
npm run test          # run all tests once (vitest run)
npm run test:watch    # run tests in watch mode
npm run test:coverage # run tests with coverage report
npx vitest run src/path/to/file.test.ts  # run a single test file
npm run db:new        # scaffold a new migration file: npm run db:new -- <name>
npm run db:push       # apply local migrations to remote
npm run db:pull       # pull remote schema → supabase/migrations/ (avoid — prefer db:new + db:push)
npm run db:types      # regenerate src/types/database.types.ts from remote schema
npm run db:test       # run pgTAP database tests against the local Supabase stack
```

**Migration workflow** (local-first): write migrations locally → push to remote → regenerate types.

```bash
npm run db:new -- add_some_feature   # creates supabase/migrations/<timestamp>_add_some_feature.sql
# edit the generated file, then:
npm run db:push                      # applies it to the remote DB
npm run db:types                     # regenerates src/types/database.types.ts
```

Never use `db:pull` to capture dashboard changes — write migrations locally instead.

**Pre-commit hook** (lint-staged): on every commit, `eslint --fix` runs on staged JS/TS files and `prettier --write` runs on all staged files. ESLint errors that are not auto-fixable will block the commit.

## Architecture

**Stack**: Next.js 15 App Router, TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth), AWS S3, React Three Fiber.

### Rendering boundary

Server components are the default. Add `"use client"` only at the lowest boundary where interactivity or browser APIs are required — never at the page level unless the entire page is interactive. Pass server-fetched data down as props to keep client bundles small.

### Data fetching

Fetch data in server components and pass it as props. TanStack Query is scoped to client-side **mutations and real-time updates only** — not for initial data loads that can be handled server-side.

### Auth & Session

Middleware at `src/middleware.ts` → `src/lib/supabase/middleware.ts` refreshes Supabase sessions on every request and redirects unauthenticated users to `/auth/login`.

Always use `supabaseServer()` from `src/lib/supabase/server.ts` as the single server-side Supabase client factory.

API routes authenticate via `requireUser(supabase)` from `src/app/api/_shared/auth.ts`. It returns `{ supabase, user }` on success or a `Response` (401) on failure — always guard with `instanceof Response`.

### API Route Structure

Each resource follows a flat layout with a `__tests__/` subdirectory for tests:

```
src/app/api/<resource>/
  route.ts       — HTTP boundary only: authenticate, parse DTO, call service, return response
  dto.ts         — Zod schemas for all request/response shapes
  service.ts     — all business logic, DB queries, and S3 operations
  mappers.ts     — row → response shape (signs S3 URLs, etc.) — only when needed
  __tests__/
    dto.test.ts
    service.test.ts
    mappers.test.ts
```

`route.ts` must not contain DB queries or S3 calls directly. Shared HTTP helpers (`jsonOk`, `jsonError`) live in `src/app/api/_shared/http.ts`. Shared S3 helpers (`signGetFileUrl`, `signPutObjectUrl`, `deleteObjectsByBucket`) live in `src/app/api/_shared/s3.ts`.

### Database Schema (Supabase)

Key tables: `assets`, `asset_files`, `projects`, `project_nodes`.

- An `asset` represents a guitar part. It has one or more `asset_files` (variants: `original`, `preview`).
- A `project` has many `project_nodes`, each referencing an `asset` with a `transforms` JSON column `{ position, rotation, scale }`.
- `assets.meta` is a freeform JSON column used for parametric neck params (`meta.neck`), mounting data (`meta.mounting`), and provenance (`meta.source`).

**Migrations**: `supabase/migrations/` holds the canonical schema DDL. Always write migrations locally — never use `db:pull` to capture dashboard changes.

**Generated types**: `src/types/database.types.ts` is fully generated — never edit it manually. Run `npm run db:types` after schema changes. It is excluded from ESLint. The `Database` type it exports is wired into all three Supabase client factories (`supabaseServer`, `supabaseBrowser`, `updateSession`), so `.from()` calls, insert/update payloads, and RPC calls are all schema-typed.

Key enums from the generated schema: `file_variant` (`"original" | "optimized" | "preview"`), `part_type` (`"body" | "neck" | "headstock" | ...`), `upload_status` (`"approved" | "rejected" | "pending"`), `node_type` (`"assembly" | "part"`). Use `Database["public"]["Enums"]["<name>"]` to reference them in service/mapper types.

**RLS policy model**: All four tables have RLS enabled. The access model is:

- `projects` / `project_nodes` — owner-only for all operations. No public or cross-user access.
- `assets` / `asset_files` — owner can read/write their own rows; `approved` assets and their files are publicly readable (anon + authenticated). Owners cannot set `upload_status = 'approved'` — only `service_role` can approve assets.
- `project_nodes` asset reference — a node's `asset_id` must point to either an asset owned by the caller or any approved asset. This is the community library access path.

When writing service code that reads or mutates these tables, the RLS policies are the last line of defence — but always apply `owner_id` / `project_id` filters at the query level too so queries never silently return zero rows instead of throwing.

### S3 Credentials

`src/lib/s3/client.ts` switches credential strategy at runtime:

- **Vercel** (`VERCEL=1`): OIDC via `AWS_ROLE_ARN`
- **Local**: `~/.aws` profiles via `AWS_PROFILE` env var

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`, `S3_BUCKET`, `AWS_REGION`, and either `AWS_ROLE_ARN` (Vercel) or `AWS_PROFILE` (local). These live in `.env.local`.

### Procedural Neck

`src/lib/neck/mesh.ts` generates a fully parametric guitar neck as Three.js `BufferGeometry` (core, fretboard, nut, frets). Parameters are defined and validated by `NeckParamsSchema` in `src/lib/neck/params.ts`. The exported `buildProceduralNeckMesh(params)` returns a `THREE.Group`. The React wrapper is `src/components/project-playground/procedural-neck-mesh.tsx`.

Parametric necks are stored in Supabase with `upload_status: null` and no S3 object key — the mesh is generated client-side from `assets.meta.neck` on load.

### Project Creation Flow

New projects are created via a strategy pattern in `src/components/projects/new-project/strategies/`:

- `blank` — empty project
- `template` — copies a built-in GLB from `TEMPLATE_S3_KEYS` in `src/app/api/assets/service.ts`
- `import` — user uploads a GLB via presign → upload → finalize at `/api/assets/import`

### Preview Generation

Project thumbnails are rendered client-side: Three.js scene → offscreen canvas → PNG blob → presign (`/api/projects/preview/presign`) → PUT to S3 → finalize (`/api/projects/preview`). Client helpers live in `src/lib/preview/project-client.ts`; the render logic is in `src/lib/preview/project.ts` (dynamically imported to keep it out of the initial bundle).

## Testing

### Database tests (pgTAP)

`supabase/tests/` holds SQL tests that run against the local Supabase stack using pgTAP. These test RLS policies and database functions — things that cannot be verified at the application layer.

```
supabase/tests/
  rls_projects.sql      — projects table RLS
  rls_assets.sql        — assets table RLS (incl. self-approval block)
  rls_asset_files.sql   — asset_files table RLS
  rls_project_nodes.sql — project_nodes table RLS (incl. community asset access)
  functions.sql         — create_project_with_root / promote_project_root RPCs
```

Run with `npm run db:test` (requires the local Supabase stack to be running via `supabase start`).

Each file follows this pattern:

```sql
begin;
select plan(<n>);          -- declare expected test count
-- fixtures inserted as postgres (bypasses RLS)
-- tests with role-switching:
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);
-- assertions via ok(), is(), lives_ok(), throws_ok()
select * from finish();
rollback;                  -- all fixtures cleaned up automatically
```

When adding new RLS policies or DB functions, add a corresponding test file (or extend an existing one). Test both the blocking side (`throws_ok` / zero rows) and the allowing side (`lives_ok` / expected row count) for every policy branch.

### Application tests (Vitest)

Vitest runs in **Node.js only** — no DOM or browser environment. Tests cover service functions, lib utilities, mappers, and DTO schemas. Preview and WebGL-dependent code cannot be tested in this environment.

### File structure

- **`src/lib/` and `src/stores/`**: co-locate test files next to the source (`foo.test.ts` beside `foo.ts`).
- **`src/app/api/`**: use a `__tests__/` subdirectory per resource folder. This prevents the source files from being overwhelmed when a resource has dto, service, and mapper tests.

### Mocking patterns

**`vi.mock` calls must be at module level** (outside `describe`/`it`) — Vitest hoists them before any imports execute.

Mock `@/lib/s3/client` and `@/lib/supabase/server` in every service test to avoid real AWS/Supabase calls:

```ts
vi.mock("@/lib/supabase/server", () => ({ supabaseServer: vi.fn() }));
vi.mock("@/lib/s3/client", () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  S3_BUCKET: "test-bucket",
}));
```

Mock `@/app/api/_shared/s3` in mapper tests to stub `signGetFileUrl` while keeping `unwrapRelation` pure:

```ts
vi.mock("@/app/api/_shared/s3", () => ({
  unwrapRelation: <T>(v: T | T[] | null | undefined): T | null => {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  },
  signGetFileUrl: vi.fn(),
}));
```

**Supabase mock chain pattern** for service tests (supports fluent `.from().select().eq().single()` chains):

```ts
import type { supabaseServer } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof supabaseServer>>;

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  for (const m of [
    "select",
    "eq",
    "insert",
    "update",
    "delete",
    "order",
    "limit",
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

function makeDb(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue(makeChain(result)),
    rpc: vi.fn().mockReturnValue(makeChain(result)),
  } as unknown as Db;
}
```

For services that accept `SupabaseClient<Database>` directly (e.g. `nodes/service.ts`), cast with `as unknown as SupabaseClient<Database>` and import `Database` from `@/types/database.types`.

When a service function makes multiple sequential DB calls, use `.mockReturnValueOnce()` for each call in order.

**Clear mock state between tests** with `vi.clearAllMocks()` in `beforeEach` whenever a mock is shared across multiple tests in a `describe` block — otherwise call counts accumulate.

## Linting & Formatting

ESLint runs `typescript-eslint/recommendedTypeChecked` plus Prettier as an error. The pre-commit hook auto-fixes formatting, but logic errors block the commit. Write code that passes lint from the start to avoid pre-commit failures.

### Rules that commonly bite in test files

**`@typescript-eslint/require-await` (error)** — An `async` function must contain at least one `await`. Mock helper functions that return promises should use `Promise.resolve()` instead of `async`:

```ts
// wrong — triggers require-await
const makeSupabase = () => ({
  auth: { getUser: async () => ({ data: null }) },
});

// correct
const makeSupabase = () => ({
  auth: { getUser: () => Promise.resolve({ data: null }) },
});
```

**`@typescript-eslint/no-explicit-any` (error)** — Never use `any`. For mock objects that need to satisfy a concrete type, cast at the factory level with `as unknown as TargetType` rather than at each call site:

```ts
// wrong — repeated as any at every call site
const result = await getOwnedProject(db as any, id, userId);

// correct — cast once in makeDb, clean call sites
function makeDb(result) {
  return { from: vi.fn()... } as unknown as Db; // Db = Awaited<ReturnType<typeof supabaseServer>>
}
const result = await getOwnedProject(db, id, userId);
```

**`unused-imports/no-unused-imports` (error)** — Every import must be used. Remove imports when the value they provide is no longer referenced. Type-only imports (`import type`) are subject to the same rule.

**`prettier/prettier` (error, auto-fixable)** — Formatting is enforced as an error but is always auto-fixed by the pre-commit hook and by `npm run format`. Run `npm run format` before committing if the hook is failing on formatting alone.

**`@typescript-eslint/no-unsafe-*` (warning)** — The five `no-unsafe-*` rules are downgraded to warnings. Supabase client calls are now fully typed via `<Database>`, but fetch utilities, stores, and preview client still use `any` at response boundaries. Do not suppress these warnings in new code — fix the root cause instead.

## Git

Never run `git add`, `git commit`, or any command that modifies git state. The user manages all git operations.

## Coding Conventions

- `@/*` maps to `src/`
- `cn()` from `src/lib/utils.ts` for class merging
- `"use client"` only at the smallest necessary boundary — never at page level
- Shared UI primitives in `src/components/ui/`; reusable non-UI logic in `src/lib/`
- Avoid `any` — use `unknown` and narrow explicitly, or `as unknown as ConcreteType` for unavoidable mock casts
- Catch errors as `unknown` and narrow before use
