# Implementation Notes — Cycle 02

## Summary

Set up Turso database layer with Drizzle ORM and libsql adapter in the API package. Local development works via `turso dev` CLI, tests use in-memory SQLite, and the full stack runs correctly inside Cloudflare Workers via Wrangler.

## What Was Built

- Database client factory using Drizzle ORM with libsql adapter
- Minimal health_checks schema to prove read/write connectivity
- Database middleware wired into Hono app context
- Integration test that inserts and reads a row from an in-memory database
- Documentation for local Turso setup and usage

## Files Changed

### Created

- `packages/api/src/db/client.ts` — Database client factory (createDatabase function)
- `packages/api/src/db/schema.ts` — Minimal Drizzle schema with health_checks table
- `packages/api/drizzle.config.ts` — Drizzle Kit configuration for migrations
- `packages/api/src/__tests__/db.test.ts` — Test proving insert and read works
- `packages/api/.dev.vars` — Local dev environment variables (gitignored)
- `docs/turso-local-setup.md` — Guide for local Turso development setup

### Modified

- `packages/api/src/index.ts` — Added database middleware and typed bindings
- `packages/api/src/__tests__/health.test.ts` — Updated to pass env bindings for test
- `packages/api/package.json` — Added @libsql/client, drizzle-orm, drizzle-kit dependencies
- `.gitignore` — Added .dev.vars, *.db, *.db-journal

## Decisions Made

- Used `file::memory:` for test database instead of requiring a running Turso server — keeps tests fast and CI-friendly with no external dependencies.
- Used HTTP URL (`http://127.0.0.1:8080`) for local dev via `turso dev` rather than file-based URL — mirrors production Turso behavior more closely.
- Created database client per-request in middleware — simple approach that works well with Workers' stateless model. Connection pooling can be considered later if needed.
- Added `.dev.vars` to `.gitignore` since it can contain auth tokens in production-like setups.

## Plan Deviations

- Added `drizzle-kit` as a dev dependency (not explicitly in the plan but necessary for the Drizzle config to work and for future migration support).
- Used a temporary `/db-test` route during Workers compatibility testing, then removed it after verification.

## Test Results

- Test step 1 (turso dev starts): PASS — sqld starts on port 8080, no errors
- Test step 2 (API connects via wrangler dev): PASS — health endpoint returns 200, no connection errors
- Test step 3 (test suite passes): PASS — 2/2 tests pass, including insert+read test
- Test step 4 (docs folder exists): PASS — docs/turso-local-setup.md created with setup guide

## Challenges and Learnings

- `@libsql/client` auto-detects the runtime environment and uses the correct transport (HTTP for Workers, native for Node.js). No special import path (`@libsql/client/web`) was needed.
- `turso dev` uses ephemeral storage by default. Use `--db-file` flag to persist data across restarts.
- Hono's `app.request()` test helper accepts a third argument for env bindings, making it easy to test Workers apps without a running server.
- Drizzle's `db.run()` method accepts raw SQL strings, useful for one-off table creation in tests without needing migration infrastructure.

## Notes for REFLECT

- Workers compatibility confirmed — no issues with @libsql/client in Cloudflare Workers runtime via Wrangler.
- The turso dev CLI (v1.0.15) works well for local development. No need to switch to libsql-server.
- Database files (*.db, *.db-journal) and .dev.vars are gitignored.
- Position should reflect: database layer is set up with Drizzle ORM and local dev support. Ready for schema work and auth feature implementation.
