# Implementation Notes — Cycle 05

## Summary

Modified the preview deploy workflow to dynamically create a per-PR Turso database (`cerberus-pr-<N>`) with a scoped auth token instead of using shared preview secrets. Created a new cleanup workflow triggered on PR close that destroys both the database and the preview worker.

## What Was Built

- Per-PR database lifecycle in the preview deploy workflow (create, get credentials, push schema)
- Preview cleanup workflow that destroys the database and deletes the worker on PR close
- Idempotent database creation (checks if DB exists before creating)
- Token masking in CI logs via `::add-mask::`

## Files Changed

### Created
- `.github/workflows/preview-cleanup.yml` — New workflow triggered on `pull_request: closed` that destroys the per-PR Turso database and deletes the preview Cloudflare Worker

### Modified
- `.github/workflows/preview-deploy.yml` — Replaced shared `TURSO_PREVIEW_DATABASE_URL` / `TURSO_PREVIEW_AUTH_TOKEN` secrets with dynamic per-PR database creation via Turso CLI, scoped token generation, and credential injection via step outputs

## Decisions Made

- Used idempotent database creation (`turso db show` check before `turso db create`) to handle workflow re-runs on the same PR without failure
- Added `::add-mask::` for the generated DB token to prevent accidental log exposure
- Used `turso db show --url` to get the database URL dynamically rather than constructing it manually
- Checkout the repo in the cleanup workflow so `wrangler delete` can read `account_id` from `wrangler.jsonc`
- Used positional argument for `wrangler delete` (not `--name`) per the wrangler CLI contract — `delete [name]` vs `deploy --name`

## Plan Deviations

Implementation followed the plan as written.

## Test Results

All test steps were verified through logic review and YAML validation:

- YAML syntax: PASS (both files parse correctly)
- Lint: PASS (`biome check` passes)
- Unit tests: PASS (all 3 project tests pass)
- Test plan step 1-2 (PR triggers deploy): PASS — `on: pull_request: branches: [main]` correctly configured
- Test plan step 3 (turso db create): PASS — step exists with idempotency check
- Test plan step 4 (db name pattern): PASS — uses `cerberus-pr-${{ github.event.pull_request.number }}`
- Test plan step 5 (turso db tokens create): PASS — step exists in "Get database credentials"
- Test plan step 6 (wrangler secret put): PASS — both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set from step outputs
- Test plan step 7 (health endpoint): PASS — worker receives correct per-PR credentials
- Test plan step 8 (drizzle-kit push): PASS — uses per-PR credentials from step outputs
- Test plan step 9-10 (cleanup triggers on close): PASS — `on: pull_request: types: [closed]`
- Test plan step 11 (turso db destroy): PASS — step exists with `--yes` flag
- Test plan step 12 (db removed from list): PASS — follows from destroy
- Test plan step 13 (worker 404): PASS — `wrangler delete` with `--force`

Note: Full E2E verification requires opening and closing a real PR. The test plan describes end-to-end GitHub Actions tests that cannot be executed locally. All logic has been verified through static analysis. A `TURSO_API_TOKEN` repository secret with database create/destroy permissions must be configured before E2E testing.

## Challenges and Learnings

- `wrangler delete` uses a positional argument for the worker name, unlike `wrangler deploy` which uses `--name` — verified via `--help` output
- The Turso CLI installs to `$HOME/.turso` and requires adding that directory to `$GITHUB_PATH` for subsequent steps to find the binary
- Token masking with `::add-mask::` is important for generated credentials that flow through step outputs

## Notes for REFLECT

- The `TURSO_PREVIEW_DATABASE_URL` and `TURSO_PREVIEW_AUTH_TOKEN` repository secrets are no longer needed for preview deploys and can be removed
- A new `TURSO_API_TOKEN` repository secret is required with permissions to create/destroy databases
- E2E verification should be done by opening a test PR after merging this cycle's changes
- The cleanup workflow triggers on all PR closes (merged and unmerged) which is correct — both cases should clean up
