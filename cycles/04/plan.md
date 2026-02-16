# Plan — Cycle 04

## Approach

Create per-environment Turso databases via the Turso CLI, store credentials as Cloudflare Worker secrets and GitHub Actions secrets, and add a CI migration step that runs Drizzle migrations against the target environment's database before each deploy.

## Steps

1. Create Turso databases for preview, staging, and production via Turso CLI
2. Store TURSO_DATABASE_URL and TURSO_AUTH_TOKEN as Cloudflare Worker secrets for staging and production
3. Add GitHub Actions secrets for Turso credentials per environment
4. Add a migration CI step that runs Drizzle migrations against the target env DB before deploy
5. Update health endpoint to confirm DB connectivity

## How to Test It

1. **Action:** Run `pnpm dev` locally, hit `GET http://localhost:8787/health`
   **Verify:** Response contains `{"db": "ok"}`
2. **Action:** Push a branch, wait for preview deploy, hit `GET https://<preview-url>/api/health`
   **Verify:** Response contains `{"db": "ok"}`
3. **Action:** Merge to main, wait for staging deploy, hit `GET https://staging.cerberus.../api/health`
   **Verify:** Response contains `{"db": "ok"}`
4. **Action:** Tag a release, wait for production deploy, hit `GET https://cerberus.../api/health`
   **Verify:** Response contains `{"db": "ok"}`
5. **Action:** Add a new migration file, push to a branch, wait for preview deploy
   **Verify:** Migration is applied — confirm via health endpoint or a test query against the preview DB

## Risks and Unknowns

- Risk: Drizzle migrations might fail against remote Turso from CI — mitigation: test locally against a remote Turso DB first
- Unknown: How Turso auth tokens are scoped (per-database vs per-group)
- Risk: Multiple preview deploys sharing one DB could cause conflicts — mitigation: use a dedicated preview DB
- Unknown: Whether per-PR databases are feasible with Turso

## First Move

Review the existing health endpoint and DB middleware code to understand current behavior and what needs to change.
