# Reflect — Cycle 20

## What Worked

- **Inline audit writes in handlers instead of middleware wrapping**: The plan called for a Hono middleware to intercept events, but the implementation put audit writes directly inside each handler. This gave full access to handler-specific context (new user ID after registration, attempted email on failed login) without needing to reverse-engineer events from response codes. The deviation simplified the code while achieving the same outcome.
- **Best-effort try/catch in writeAuditLog**: Wrapping the audit insert in a silent catch ensures audit logging never breaks the main auth flow. This is the correct tradeoff — losing a log entry is preferable to failing a login.
- **Centralized getClientIp helper**: Abstracting IP extraction into one function (CF-Connecting-IP → X-Forwarded-For → "unknown") addressed the risk flagged in plan.md about differing behavior across local dev and Cloudflare Workers.
- **Following existing test patterns exactly**: Mirroring the admin-setup-journey test structure (CREATE_TABLES, in-memory SQLite, Hono testApp) meant the 18 new tests worked on first try with no infrastructure issues.
- **Direct table queries for test assertions**: Querying the auditLogs table directly via Drizzle rather than through the GET /audit-logs endpoint isolated test concerns — a GET endpoint failure cannot cascade into auth logging tests.

## What Didn't Work

- No significant blockers encountered. The one deviation from plan (inline writes vs. middleware interception) was a deliberate simplification, not a failure — the middleware approach would have required complex response-parsing logic for minimal benefit.

## What Changed in Understanding

The planned middleware interception approach proved unnecessary. Inline audit writes in handlers are simpler and provide richer context (user IDs, emails, permission names) that a post-processing middleware would not have access to. The centralized `writeAuditLog()` utility function and `getClientIp()` helper still keep shared logic in one place, achieving the same separation of concerns the middleware was meant to provide. The silent try/catch pattern for best-effort writes is a reusable pattern applicable to future non-critical features (metrics, analytics).

## Product Changes

No product definition changes this cycle. The implementation-notes observe that audit logging creates a foundation for security compliance features and could differentiate Cerberus for the solo-developer persona, but these are future possibilities, not changes to the current product definition.
