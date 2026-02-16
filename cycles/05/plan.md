# Plan — Cycle 05

## Approach

Use the Turso CLI in GitHub Actions to manage database lifecycle: `turso db create` and `turso db tokens create` in the deploy workflow, pass credentials as wrangler secrets, and add a separate cleanup workflow with `turso db destroy` and `wrangler delete`.

## Steps

1. In the preview deploy job, add a step that runs `turso db create cerberus-pr-${{ github.event.number }}`
2. Generate a scoped auth token with `turso db tokens create`
3. Set the DB URL and token as wrangler secrets for the preview worker
4. Deploy the worker with wrangler
5. Run `drizzle-kit push` against the new per-PR database
6. Create a new cleanup workflow triggered on `pull_request: closed`
7. In the cleanup workflow, run `turso db destroy` and `wrangler delete`

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: `turso db create` might fail if a database with that name already exists from a previous run — mitigation: check if it exists first or use --if-not-exists flag
- Unknown: Not sure what permissions the TURSO_API_TOKEN needs for `db create` and `db destroy` vs just `db tokens create`
- Risk: Cleanup workflow might not trigger if PR is force-deleted — mitigation: accept orphaned DBs for now, clean up manually
- Unknown: Whether `wrangler delete` requires specific flags to remove a preview deployment

## First Move

Read the existing preview deploy workflow file to understand the current structure before modifying it.
