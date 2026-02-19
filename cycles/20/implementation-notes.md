# Implementation Notes — Cycle 20

## Summary

Added audit logging for all authentication and authorization events. A new `audit_logs` table stores entries with event type, user ID, IP address, timestamp, and optional metadata. Auth endpoints (register, login, refresh, revoke) and the requirePermission authorization middleware now write audit entries on every operation. A new GET /audit-logs endpoint provides paginated, filterable access to the log. 18 new tests cover all behaviors with zero regressions on the existing 131 tests (102 API + 29 dashboard).

## What Was Built

- **audit_logs Drizzle table** (`packages/api/src/db/schema.ts`): New `auditLogs` table with `id` (auto-increment PK), `eventType` (text, not null), `userId` (text, nullable), `ipAddress` (text, not null), `timestamp` (text, not null, ISO default), and `metadata` (text, nullable). Follows the exact same pattern as all other tables in the schema — text timestamps with `$defaultFn(() => new Date().toISOString())`.

- **Audit utility module** (`packages/api/src/middleware/audit.ts`): Two exports — `writeAuditLog(db, entry)` inserts into the audit_logs table with a try/catch that silently swallows errors (best-effort logging that never breaks the main operation), and `getClientIp(c)` extracts the client IP from `CF-Connecting-IP` header, then `X-Forwarded-For`, then falls back to `"unknown"`. This centralized approach avoids duplicating the insert logic across every handler.

- **Auth endpoint audit logging** (modified `register.ts`, `login.ts`, `refresh.ts`, `revoke.ts`): Each handler now imports `writeAuditLog` and `getClientIp` and writes an audit entry after the main operation. Login has two write points — `event_type='login'` on success, `event_type='login_failed'` on both non-existent user and wrong password, with `userId: null` and the attempted email in metadata. Register writes `event_type='register'` with the new user's ID. Refresh writes `event_type='refresh'`. Revoke writes `event_type='revoke'`.

- **Authorization audit logging** (modified `packages/api/src/middleware/authorization.ts`): The `requirePermission` middleware now writes `event_type='authz_granted'` before calling `next()` on success, and `event_type='authz_denied'` before returning 403. Both include the checked permission name in metadata as `JSON.stringify({ permission: permissionName })`.

- **GET /audit-logs endpoint** (`packages/api/src/rbac/audit-logs.ts`): Returns audit entries ordered by timestamp descending with pagination (`?page=1&limit=20`) and optional event type filtering (`?event_type=login`). Response shape: `{ data: [...], pagination: { page, limit, total } }`. Limit is capped at 100. Endpoint is protected behind authMiddleware + requirePermission("manage_users").

- **Test suite** (`packages/api/src/__tests__/audit-logs.test.ts`): 18 test cases across 4 describe blocks: auth endpoint logging (6 tests), authorization logging (2 tests), GET /audit-logs endpoint (5 tests), and field completeness (5 tests). Tests verify audit entries by directly querying the auditLogs table via Drizzle after each operation.

## What Worked

- **Inline audit writes in handlers rather than middleware wrapping**: The plan called for a "Hono middleware that intercepts auth and authz events," but the actual implementation put audit writes directly inside each handler. This was the right call — a middleware-based approach would have required complex logic to determine event types (register vs login vs refresh) from the response, and wouldn't have access to handler-specific data like the newly created user ID. Direct handler writes are simpler and give full access to the operation context.

- **Best-effort try/catch in writeAuditLog**: Wrapping the insert in a silent try/catch means a database error in audit logging can never break the main auth flow. This is the right tradeoff for audit logging — losing a log entry is far better than failing a login.

- **Centralized getClientIp helper**: Abstracting IP extraction into one function addresses the risk flagged in plan.md about IP extraction differing between local dev and Cloudflare Workers. The helper checks CF-Connecting-IP (Workers production), X-Forwarded-For (proxied environments), and falls back to "unknown" (local dev).

- **Following existing test patterns exactly**: The test file mirrors the admin-setup-journey pattern with its own CREATE_TABLES string, in-memory SQLite, and Hono test app setup. This made the tests work on first try with no infrastructure issues.

- **Direct table queries for test assertions**: Instead of testing through the GET /audit-logs endpoint (which adds auth complexity), tests query the auditLogs table directly via Drizzle. This isolates the test — a failure in the GET endpoint doesn't cascade into auth logging tests.

## What Didn't Work

- **No significant blockers encountered.** The implementation proceeded as planned. The one deviation (inline writes vs middleware interception) was a deliberate simplification, not a failure.

## Files Changed

### Created
- `packages/api/src/middleware/audit.ts` — Audit logging utility with `writeAuditLog()` and `getClientIp()` helpers
- `packages/api/src/rbac/audit-logs.ts` — GET /audit-logs route handler with pagination and event_type filter
- `packages/api/src/__tests__/audit-logs.test.ts` — 18 tests covering all audit log behaviors

### Modified
- `packages/api/src/db/schema.ts` — Added `auditLogs` table definition
- `packages/api/src/auth/register.ts` — Added audit log write on successful registration
- `packages/api/src/auth/login.ts` — Added audit log writes on login success and login failure (both code paths)
- `packages/api/src/auth/refresh.ts` — Added audit log write on successful token refresh
- `packages/api/src/auth/revoke.ts` — Added audit log write on successful token revocation
- `packages/api/src/middleware/authorization.ts` — Added audit log writes for authz_granted and authz_denied in requirePermission
- `packages/api/src/index.ts` — Imported and mounted GET /audit-logs endpoint behind auth + manage_users permission

## Decisions Made

- **Audit writes inline in handlers vs. middleware wrapping**: Chose inline writes because they have direct access to handler-specific context (new user ID after registration, attempted email on failed login). A pure middleware approach would need to reverse-engineer the event from the response status code and path, which is fragile.

- **userId as nullable text, not integer FK**: Login failures have no user ID (user doesn't exist or password is wrong), so userId must be nullable. Using text rather than integer avoids foreign key complexity and allows storing the string form directly from `user.sub`.

- **timestamp as text with ISO default, not integer epoch**: Matches the existing pattern used by every other table (createdAt fields). Consistency with the codebase outweighs any marginal benefit of integer timestamps.

- **Best-effort (silent catch) vs. strict logging**: Chose best-effort — audit logging should never prevent a user from logging in or registering. The catch is deliberately empty because there's no useful recovery action.

- **GET /audit-logs requires manage_users permission**: Chose manage_users over a new "view_audit_logs" permission because the endpoint is about user activity monitoring, which aligns with user management. Adding a new permission would require schema changes and seed updates for minimal benefit at this stage.

- **Metadata as JSON-stringified text**: Chose a flexible JSON string column over typed columns for metadata because different event types have different metadata needs (email for login_failed, permission name for authz events). This avoids schema changes when new event types are added.

## Plan Deviations

- **Approach changed from middleware interception to inline handler writes**: The plan specified "Build a Hono middleware that intercepts auth and authz events." The actual implementation writes audit entries directly inside each handler rather than using a wrapping middleware. The plan's "auditLog() Hono middleware" became a simpler `writeAuditLog()` utility function. This deviation simplified the implementation — a middleware would have needed to post-process responses to determine event types, while inline writes have full context. The `getClientIp()` helper and the centralized `writeAuditLog()` function still keep the shared logic in one place (middleware/audit.ts).

## Test Results

- audit-logs.test.ts: 18/18 PASS
  - Auth endpoint audit logging (6 tests): register, login success, login failure (wrong password), login failure (non-existent user), refresh, revoke — all produce correct audit entries
  - Authorization audit logging (2 tests): authz_granted with permission in metadata, authz_denied with permission in metadata
  - GET /audit-logs endpoint (5 tests): paginated results, event_type filter, 401 without auth, 403 without manage_users, page/limit params respected
  - Field completeness (5 tests): all entries have event_type/ip_address/timestamp, register has user_id, login has user_id, login_failed has null user_id, register metadata includes email
- All existing tests: 102/102 API + 29/29 dashboard PASS (zero regressions)
- **Total: 149 tests passing (120 API + 29 dashboard)**

## Challenges and Learnings

### Challenges
- No significant challenges. The existing codebase patterns (Hono middleware, Drizzle schema, test setup) were consistent enough that the implementation was straightforward.

### Learnings
- The Hono test harness (`testApp.request()`) makes it easy to test middleware and handler behavior without starting a server — the in-memory SQLite approach works well for verifying database side effects like audit entries.
- Silent try/catch for non-critical database writes is a useful pattern for any future "best-effort" features (metrics, analytics, etc.).

## Product Insights

- **Audit logging creates a foundation for security compliance features.** Once a dashboard UI is added to view audit logs (out of scope this cycle), Cerberus can offer security monitoring as a product feature — not just an internal diagnostic tool. This could be a differentiator for the "solo developer managing multiple apps" persona.
- **The current event types (7 total) cover the auth lifecycle but not the full RBAC management lifecycle.** When RBAC management events are added in a future cycle, the same pattern (writeAuditLog in handlers) will extend cleanly.

## Notes for REFLECT

- The project now has 149 tests passing (120 API + 29 dashboard), up from 131.
- All 5 success criteria are met: audit_logs table exists, auth endpoints produce entries, authz checks produce entries, GET /audit-logs returns paginated filtered results, and all entries include the required fields.
- The audit logging feature from product.md ("Audit logging — System logs all authentication and authorization events for review") is now partially implemented — the API-side logging and query endpoint are complete, but no dashboard UI for viewing logs exists yet.
- No technical debt introduced. The best-effort try/catch is an intentional design choice, not a shortcut.
- Next logical cycles: dashboard UI for audit logs, RBAC management event logging, audit log retention/cleanup.
