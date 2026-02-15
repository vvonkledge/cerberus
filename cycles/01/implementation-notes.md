# Implementation Notes — Cycle 01

## Summary
Set up a pnpm monorepo with two packages: a Hono API on Cloudflare Workers and a React + Vite + Tailwind dashboard. Both run locally via `pnpm dev`, pass linting via Biome, and have passing Vitest example tests.

## What Was Built
- pnpm workspace monorepo structure
- Hono API with health check endpoint on Cloudflare Workers (wrangler)
- React dashboard with Vite and Tailwind CSS
- Shared TypeScript config at root
- Biome linting/formatting at root
- Vitest test setup with one example test per package

## Files Changed

### Created
- `package.json` — root workspace config with dev/lint/test scripts
- `pnpm-workspace.yaml` — workspace package references
- `tsconfig.json` — shared TypeScript compiler options
- `biome.json` — Biome linter/formatter config (tab indentation, recommended rules)
- `.gitignore` — ignores node_modules, dist, .wrangler
- `packages/api/package.json` — API package with Hono, wrangler, vitest deps
- `packages/api/tsconfig.json` — extends root, adds Cloudflare Workers types
- `packages/api/wrangler.jsonc` — wrangler config for cerberus-api
- `packages/api/src/index.ts` — Hono app with /health endpoint
- `packages/api/src/__tests__/health.test.ts` — health check test
- `packages/dashboard/package.json` — dashboard package with React, Vite, Tailwind deps
- `packages/dashboard/tsconfig.json` — extends root, adds JSX support
- `packages/dashboard/vite.config.ts` — Vite config with React plugin
- `packages/dashboard/postcss.config.js` — PostCSS with Tailwind
- `packages/dashboard/tailwind.config.js` — Tailwind content paths
- `packages/dashboard/index.html` — entry HTML
- `packages/dashboard/src/index.css` — Tailwind directives
- `packages/dashboard/src/main.tsx` — React root mount
- `packages/dashboard/src/app.tsx` — minimal App component
- `packages/dashboard/src/__tests__/app.test.tsx` — App component test

### Modified
- None (fresh project)

## Decisions Made
- Used tab indentation via Biome (consistent with Biome defaults and configured style)
- Used `pnpm --parallel -r run dev` for concurrent dev server startup
- Used wrangler.jsonc (JSON with comments) for wrangler config
- Used `onlyBuiltDependencies` in root package.json to approve native package build scripts (biome, esbuild, workerd, sharp)
- Dashboard test is a simple "is defined" check rather than DOM rendering to avoid needing jsdom/happy-dom setup (out of scope for this cycle)

## Plan Deviations
- Added `.gitignore` (not explicitly in plan but necessary for the repo)
- Added `pnpm.onlyBuiltDependencies` to root package.json (required by pnpm v10 for native packages)

## Test Results
- Test 1 (`pnpm install`): PASS
- Test 2 (`pnpm dev`): PASS — both API (port 8787) and dashboard (port 5173) start
- Test 3 (`curl localhost:8787/health`): PASS — returns `{"status":"ok"}` with 200
- Test 4 (dashboard loads): PASS — Vite dev server ready at localhost:5173
- Test 5 (`pnpm lint`): PASS — Biome checks all files, no errors
- Test 6 (`pnpm test`): PASS — 1 test passes in each package (2 total)
- Test 7 (packages exist): PASS — packages/api/ and packages/dashboard/ both present
- Test 8 (workspace config): PASS — pnpm-workspace.yaml references `packages/*`

## Challenges and Learnings
- Biome formatter enforces tab indentation on JSON files too — initial files written with spaces were flagged. Fixed with `biome check --write`.
- Biome's `noNonNullAssertion` rule flagged `document.getElementById("root")!` — replaced with explicit null check and throw.
- pnpm v10 requires explicit approval of native package build scripts via `onlyBuiltDependencies` — the interactive `pnpm approve-builds` doesn't work in non-interactive environments, so the config was added directly to package.json.

## Notes for REFLECT
- The monorepo foundation is working. Next cycle can build on this with actual auth logic, database setup, or CI/CD.
- Tailwind v3 is used; upgrading to v4 could be considered in a future cycle if needed.
- The dashboard test is minimal (no DOM rendering) — a future cycle adding real UI should set up jsdom/happy-dom for component testing.
