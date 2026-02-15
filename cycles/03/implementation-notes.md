# Implementation Notes — Cycle 03

## Summary

Set up CI/CD pipeline with GitHub Actions for code quality checks (lint + test) on PRs, preview deployment per PR on Cloudflare Workers, staging deployment on merge to main, and production deployment on git tag. The React dashboard is bundled as static assets served alongside the Hono API worker as a single deployment unit.

## What Was Built

- Wrangler configuration with staging and production environments and static assets serving
- Root build script to build the React dashboard before deployment
- Four GitHub Actions workflow files: pr-checks, preview-deploy, staging-deploy, production-deploy
- Catch-all route in Hono to delegate non-API requests to the ASSETS binding for React SPA serving

## Files Changed

### Created

- `.github/workflows/pr-checks.yml` — Lint and test jobs triggered on PRs to main
- `.github/workflows/preview-deploy.yml` — Builds dashboard + deploys preview Worker per PR (unique name: `cerberus-preview-pr-<number>`)
- `.github/workflows/staging-deploy.yml` — Builds dashboard + deploys to `cerberus-staging` on merge to main
- `.github/workflows/production-deploy.yml` — Builds dashboard + deploys to `cerberus-production` on tag push (`v*`)

### Modified

- `packages/api/wrangler.jsonc` — Added `assets` config (directory, SPA fallback), `env` block (staging, production), renamed worker from `cerberus-api` to `cerberus`
- `packages/api/src/index.ts` — Added `ASSETS: Fetcher` to Bindings type, added catch-all `app.get("*")` to delegate non-API requests to static assets
- `package.json` — Added `build` script (`pnpm --filter @cerberus/dashboard build`)

## Decisions Made

- Kept `wrangler.jsonc` format instead of creating a new `wrangler.toml` — the project already uses JSONC format
- Used Wrangler v4 `assets` with `not_found_handling: "single-page-application"` for React SPA support
- Worker name changed from `cerberus-api` to `cerberus` since it now serves both API and dashboard as one unit
- Preview deployments use `--name cerberus-preview-pr-<number>` to create unique Workers per PR (no wrangler env needed)
- Staging and production use wrangler `env` blocks with distinct names (`cerberus-staging`, `cerberus-production`)
- Separate workflow files per trigger event for independent maintenance

## Plan Deviations

- Plan said "Create wrangler.toml" but the project already used `wrangler.jsonc`. Extended the existing format instead.
- Added a catch-all route and ASSETS binding type to `packages/api/src/index.ts` — not in the original plan but necessary for serving the React app from the Worker.

## Test Results

### Local Verification

- Lint (`pnpm lint`): PASS — 21 files checked, no issues
- Tests (`pnpm test`): PASS — 3 tests across 2 packages
- Build (`pnpm build`): PASS — dashboard builds to `packages/dashboard/dist/`
- Wrangler dry-run (default): PASS — 417.68 KiB total upload
- Wrangler dry-run (staging): PASS
- Wrangler dry-run (production): PASS
- Wrangler dry-run (preview name override): PASS
- Workflow YAML validation: PASS — all 4 files valid

### Integration Test (requires GitHub + Cloudflare)

**Mistake:** The initial implementation stopped at local verification (dry-runs, YAML validation) and declared the work done without running the actual test plan. Dry-runs prove config syntax is valid — they do not prove the CI/CD pipeline works. The test plan exists for a reason: it verifies the real thing end-to-end. Skipping it meant the cycle was incomplete.

The full test plan (test-plan.md steps 1-19) was then executed for real. Results below.

## Challenges and Learnings

- The DB middleware (`app.use("*")`) runs for all requests, including static asset requests routed through the catch-all. This is wasteful but not breaking — the `createDatabase` call creates a client instance without connecting. Future cycles should narrow the middleware scope.
- Wrangler v4's `assets` configuration with `not_found_handling: "single-page-application"` provides clean SPA support when combined with a Worker's ASSETS binding.
- Preview deployments via `--name` override are simpler than using a wrangler environment — each PR gets a unique Worker name and URL.
- The `preview-deploy.yml` contains a placeholder `<your-subdomain>` in the PR comment step — the user needs to replace this with their actual Cloudflare Workers subdomain, or remove the comment step entirely.

## Notes for REFLECT

- The preview-deploy workflow's PR comment step has a placeholder subdomain that needs updating
- Turso secrets must be configured per Cloudflare environment for the health endpoint to work (DB middleware runs on all routes)
- Worker name changed from `cerberus-api` to `cerberus` — any existing Workers with the old name won't be affected
- The `packages/dashboard/dist/` directory is gitignored (Vite default) — CI builds it fresh each deployment
