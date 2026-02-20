# Feature Gaps

## 1. Unauthenticated Admin Bootstrap (`/seed`)

**Severity**: High
**Endpoint**: `POST /seed`
**File**: `packages/api/src/rbac/seed.ts`

### Problem

The `/seed` endpoint requires no authentication. After a production deployment, anyone who discovers the URL can register an account and call `/seed` to make themselves admin before the legitimate operator does.

The only guard is an idempotency check — once an admin role exists, subsequent calls return 409. This creates a race condition: the first caller wins.

### Recommended Fix

Require a setup secret (e.g. `ADMIN_SETUP_TOKEN` environment variable) that must be provided in the request body or header to call `/seed`. This ensures only the operator with access to Cloudflare secrets can bootstrap the admin account.
