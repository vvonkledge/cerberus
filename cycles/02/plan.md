# Plan — Cycle 02

## Approach

Use Drizzle ORM with the libsql adapter. Install dependencies in packages/api, set up a local Turso dev database, create a Drizzle config with a minimal test schema, wire the database client into the Hono app, verify with a read/write test, confirm Workers compatibility, and document the local setup.

## Steps

1. Install @libsql/client and drizzle-orm in packages/api
2. Set up local Turso dev database with turso dev CLI
3. Create Drizzle config and a minimal test schema
4. Wire database client into Hono app context
5. Write a test that inserts and reads a row
6. Test that Drizzle + libsql works in a Wrangler dev environment
7. Write docs/turso-local-setup.md

## How to Test It

1. **Action:** Run `turso dev` (or equivalent) to start local database
   **Verify:** Process starts without errors, database is accessible

2. **Action:** Run `pnpm --filter api dev` to start the API
   **Verify:** API starts and connects to local Turso without errors in logs

3. **Action:** Run `pnpm --filter api test`
   **Verify:** Test suite passes, including a test that inserts a row and reads it back

4. **Action:** Check `docs/` folder exists and contains a Turso local setup guide
   **Verify:** File exists and contains setup instructions

## Risks and Unknowns

- Unknown: Not sure if `turso dev` works well or if we should use libsql-server directly
- Risk: Drizzle's libsql adapter may have quirks with Cloudflare Workers runtime — mitigation: test compatibility in this cycle
- Unknown: Not clear how Turso local DB file should be gitignored vs managed

## First Move

Install the Turso CLI and run `turso dev` to get a local database running.
