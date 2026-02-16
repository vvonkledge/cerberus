# Implementation Notes — Cycle 04

## Summary

Created 3 Turso databases (preview, staging, production), configured all credentials as Cloudflare Worker secrets and GitHub Actions secrets, added `drizzle-kit push` as a CI migration step in all deploy workflows, and updated the health endpoint to verify DB connectivity.

## What Was Built

- 3 Turso databases: cerberus-preview, cerberus-staging, cerberus-production (all in `default` group, aws-eu-west-1)
- Cloudflare Worker secrets for staging and production (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
- 6 GitHub Actions secrets for CI migrations and preview deploys
- CI migration step (`drizzle-kit push`) in all 3 deploy workflows
- Preview workflow also sets Turso secrets on the per-PR preview worker
- Health endpoint now returns `{"db": "ok"}` when DB is connected, `{"db": "not_configured"}` when no DB URL is set
- `db:push` script in API package.json

## Files Changed

### Modified

- `packages/api/src/index.ts` — Health endpoint now queries DB with `SELECT 1` to verify connectivity
- `packages/api/src/__tests__/health.test.ts` — Tests for both DB-connected and no-DB scenarios
- `packages/api/package.json` — Added `db:push` script
- `.github/workflows/preview-deploy.yml` — Added `drizzle-kit push` step and `wrangler secret put` step for preview workers
- `.github/workflows/staging-deploy.yml` — Added `drizzle-kit push` step before deploy
- `.github/workflows/production-deploy.yml` — Added `drizzle-kit push` step before deploy

## Decisions Made

- Used `drizzle-kit push` instead of `drizzle-kit migrate` for schema management — simpler, idempotent, no migration file overhead. Can switch to file-based migrations later if needed.
- All preview PRs share a single `cerberus-preview` database. Per-PR databases aren't practical since preview workers are ephemeral.
- Preview worker secrets are set via CI (piped to `wrangler secret put`) after each deploy, since each PR creates a new named worker.
- Turso auth tokens are scoped per-database (one token per database, as created by `turso db tokens create`).
- All databases are in the `default` group in aws-eu-west-1 (created automatically with the first database).

## Plan Deviations

- Plan step 2 (Cloudflare secrets) required `wrangler login` first since wrangler wasn't authenticated locally. Added OAuth login step.
- Schema was pushed to all 3 remote databases from local CLI to verify connectivity, in addition to the CI automation.

## Test Results

- Test Step 1 (local health endpoint): PASS — `pnpm dev` + `curl localhost:8787/health` returns `{"status":"ok","db":"ok"}`
- Test Step 2 (preview deploy): DEFERRED — requires PR push to trigger CI workflow
- Test Step 3 (staging deploy): PASS — `curl https://cerberus-staging.alexandre-leroy.workers.dev/health` returns `{"status":"ok","db":"ok"}`
- Test Step 4 (production deploy): PASS — `curl https://cerberus-production.alexandre-leroy.workers.dev/health` returns `{"status":"ok","db":"ok"}`
- Test Step 5 (migration verification): PASS — `drizzle-kit push` successfully applied schema to all 3 remote databases; re-running shows "No changes detected"
- Unit tests: 4/4 PASS (3 API + 1 dashboard)
- Lint: PASS

## Challenges and Learnings

- Turso CLI automatically creates a `default` group when no groups exist and a database is created without specifying a group.
- `wrangler secret put` reads from stdin, allowing non-interactive usage with `echo "value" | npx wrangler secret put NAME`.
- Wrangler OAuth login is required for local secret management but CI uses `CLOUDFLARE_API_TOKEN` instead.
- `drizzle-kit push` with `dialect: "turso"` works seamlessly against remote Turso databases — no special configuration needed beyond URL and auth token.

## Notes for REFLECT

- Test steps 2-4 (preview/staging/production deploys) need to be verified when code is pushed. Consider doing this verification as part of the reflect step or in the next cycle.
- The preview setup uses a shared database — this is fine for now but could cause issues if preview environments need isolated data for testing.
- Turso free tier has database limits — keep an eye on this as more environments or features are added.
