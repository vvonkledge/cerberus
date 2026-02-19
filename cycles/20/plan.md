# Plan — Cycle 20

## Approach

Build a Hono middleware that intercepts auth and authz events, writes audit entries to a new Turso table, then add a GET /audit-logs endpoint for querying.

## Steps

1. Add audit_logs table schema with Drizzle (event_type, user_id, ip_address, timestamp, metadata)
2. Create an auditLog() Hono middleware that writes entries after handler execution
3. Attach the middleware to auth endpoints (register, login, refresh, revoke)
4. Add audit logging to the requirePermission middleware for authz checks
5. Build GET /audit-logs endpoint with pagination and event_type filter
6. Write tests for all audit log behaviors

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: Middleware approach might not have access to response status codes needed to determine success/failure — mitigation: use Hono's afterResponse or check c.res
- Unknown: Whether writing audit logs synchronously in the request path will add noticeable latency
- Risk: IP address extraction might differ between local dev and Cloudflare Workers — mitigation: abstract behind a helper
- Unknown: How large the metadata JSON column should be / what to store in it

## First Move

Add the audit_logs table definition to the Drizzle schema file and push the migration.
