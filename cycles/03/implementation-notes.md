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

- `docs/ci-cd.md` — Full CI/CD pipeline documentation

### Modified

- `packages/api/wrangler.jsonc` — Added `account_id`, `assets` config (directory, SPA fallback), `env` block (staging, production), renamed worker from `cerberus-api` to `cerberus`
- `packages/api/src/index.ts` — Added `ASSETS: Fetcher` to Bindings type, added catch-all `app.get("*")`, made DB middleware defensive
- `package.json` — Added `build` script and `packageManager` field

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

### Integration Test Results

**Criterion 1: PR triggers lint + tests**
- Step 1 (create branch, push): PASS
- Step 2 (open PR #1): PASS
- Step 3 (PR Checks workflow triggers): PASS
- Step 4 (lint and test jobs pass): PASS — first attempt failed (missing `packageManager` field in package.json for `pnpm/action-setup@v4`), fixed and re-triggered, second attempt passed

**Criterion 2: PR triggers preview deploy**
- Step 5 (Preview Deploy workflow triggers): PASS
- Step 6 (unique preview URL in output): PASS — `https://cerberus-preview-pr-1.alexandre-leroy.workers.dev`
- Step 7 (preview URL loads): PASS
- Step 8 (health endpoint returns 200): PASS — `{"status":"ok"}`
- Step 9 (React app loads at root): PASS — 200, HTML with React bootstrap

**Criterion 3: Merge to main deploys staging**
- Step 10 (merge PR): PASS
- Step 11 (Staging Deploy triggers): PASS — triggered automatically on push to main
- Step 12 (workflow completes): PASS — 28s
- Step 13 (staging URL loads): PASS
- Step 14 (health + React verified): PASS — `{"status":"ok"}`, 200

**Criterion 4: Tag deploys production**
- Step 15 (create and push tag v0.1.0): PASS
- Step 16 (Production Deploy triggers): PASS
- Step 17 (workflow completes): PASS — 28s
- Step 18 (production URL loads): PASS
- Step 19 (health + React verified): PASS — `{"status":"ok"}`, 200

**All 19 test steps: PASS**

### Fixes During Testing

1. **Missing `packageManager` field:** `pnpm/action-setup@v4` requires pnpm version specified in `package.json`'s `packageManager` field. Added `"packageManager": "pnpm@10.29.1"`.
2. **OAuth token vs API token:** Wrangler's OAuth token (used for local CLI auth) is NOT a Cloudflare API token. GitHub Actions needs a proper API token created from the Cloudflare dashboard. The initial attempt to use the OAuth token failed with "Unable to authenticate request [code: 10001]".
3. **Preview URL placeholder:** The PR comment step had `<your-subdomain>` — replaced with actual subdomain `alexandre-leroy`.

## Challenges and Learnings

- **Don't stop at dry-runs.** The initial implementation treated wrangler dry-runs and YAML validation as sufficient verification. They're not. A dry-run proves syntax; the real test proves the pipeline works. Always run the actual test plan.
- **`pnpm/action-setup@v4` requires `packageManager` field.** The action can't auto-detect the pnpm version — it needs `"packageManager": "pnpm@x.y.z"` in root package.json.
- **Wrangler OAuth ≠ Cloudflare API token.** Wrangler CLI uses an OAuth flow stored in `~/Library/Preferences/.wrangler/config/default.toml`. This token is NOT a Cloudflare API token and cannot be used in CI. GitHub Actions needs a real API token created from https://dash.cloudflare.com/profile/api-tokens.
- The DB middleware (`app.use("*")`) runs for all requests including static asset requests. Made it defensive (skip if `TURSO_DATABASE_URL` unset) so deployments work without Turso configured. Future cycles should narrow the middleware scope.
- Wrangler v4's `assets` with `not_found_handling: "single-page-application"` provides clean SPA support from a Worker.
- Preview deployments via `--name` override are simpler than using a wrangler environment — each PR gets a unique Worker name and URL.

## Notes for REFLECT

- All 4 success criteria verified end-to-end with real GitHub Actions and Cloudflare deployments
- Live URLs: staging at `cerberus-staging.alexandre-leroy.workers.dev`, production at `cerberus-production.alexandre-leroy.workers.dev`
- Turso secrets must be configured per Cloudflare environment for database-dependent routes
- Worker name changed from `cerberus-api` to `cerberus`
- Preview workers (e.g., `cerberus-preview-pr-1`) persist after PR close — consider cleanup automation in a future cycle
- `docs/ci-cd.md` was created documenting the full pipeline setup
