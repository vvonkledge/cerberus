# Implementation Notes — Cycle 23

## Summary
Added API key management for service-to-service authentication. Applications can now create prefixed API keys (crb_<hex>), list them, revoke them, and authenticate with them via the same Bearer token mechanism used for JWTs. The auth middleware was extended to detect key format by prefix and route to the appropriate auth path. All 5 success criteria met with 17 new tests (189 total), zero regressions.

## What Was Built
- **api_keys table** (schema.ts): New Drizzle table with id, userId, name, keyHash (SHA-256, unique), keyPrefix, createdAt, revokedAt columns. Follows existing schema patterns exactly (sqliteTable, integer PKs, text timestamps with $defaultFn).
- **API key generation** (crypto.ts): `generateApiKey()` produces `crb_` + 64 hex chars (32 random bytes). `hashApiKey()` computes SHA-256 of the full key using Web Crypto API, returning hex. Zero dependencies added.
- **POST /api-keys** (api-keys.ts): Accepts `{ name }`, generates key, stores hash + prefix, writes `api_key_created` audit log, returns `{ id, name, keyPrefix, key }` with 201. The raw key is shown only in this response.
- **GET /api-keys** (api-keys.ts): Lists all keys for the authenticated user. Returns `{ id, name, keyPrefix, createdAt, revokedAt }` — never exposes key or keyHash.
- **DELETE /api-keys/:keyId** (api-keys.ts): Soft-deletes by setting revokedAt. Checks userId ownership — returns 404 if key belongs to another user. Writes `api_key_revoked` audit log.
- **Auth middleware extension** (auth.ts): Before JWT verification, checks if Bearer token starts with `crb_`. If so, hashes it, looks up by keyHash, rejects if not found or revoked (401), and sets user context with `{ sub: userId, iat: 0, exp: 0 }`. Non-crb_ tokens fall through to existing JWT path unchanged.
- **Route registration** (index.ts): `/api-keys` mounted with authMiddleware (no permission check — any authenticated user can manage their own keys).

## What Worked
- **Prefix-based auth routing**: Detecting `crb_` prefix in the Bearer token cleanly separates API key auth from JWT auth without any ambiguity. The middleware reads naturally — if crb_, do key lookup; else, do JWT verify. This approach avoids needing a separate header (like X-API-Key) which would have required changes throughout the dashboard and existing API clients.
- **Following existing patterns**: The apiKeys table, route handlers, and audit logging all follow the exact patterns established in earlier cycles (roles.ts, password-reset-tokens, writeAuditLog). This made implementation fast and consistent with zero friction.
- **SHA-256 for key hashing**: Using SHA-256 via Web Crypto API is fast, deterministic, and sufficient for API keys (unlike passwords which need slow hashing like PBKDF2). The key has 256 bits of entropy from 32 random bytes, making brute force infeasible even with fast hashing.
- **Soft delete for revocation**: Setting revokedAt instead of deleting the row preserves audit trail and makes the revocation check simple (just check if revokedAt is set).

## What Didn't Work
- **Import sort order**: The initial implementation had `{ eq, and }` import order which biome's organizeImports flagged. Fixed by sorting to `{ and, eq }`. Minor but caught during lint verification.
- No other significant blockers. Implementation proceeded as planned.

## Files Changed

### Created
- `packages/api/src/rbac/api-keys.ts` — Route handlers for POST, GET, DELETE /api-keys with audit logging
- `packages/api/src/__tests__/api-keys.test.ts` — 17 tests covering CRUD, auth, audit, error cases

### Modified
- `packages/api/src/db/schema.ts` — Added apiKeys table definition
- `packages/api/src/auth/crypto.ts` — Added generateApiKey() and hashApiKey() functions
- `packages/api/src/middleware/auth.ts` — Extended to detect crb_ prefix and authenticate via hash lookup
- `packages/api/src/index.ts` — Registered /api-keys route with authMiddleware

## Decisions Made
- **SHA-256 over PBKDF2 for key hashing**: API keys have high entropy (256 bits), so a fast hash is appropriate. PBKDF2's deliberate slowness is designed for low-entropy passwords, not random tokens. SHA-256 also means auth lookups stay fast.
- **No separate X-API-Key header**: Reusing the Authorization: Bearer header with prefix detection keeps the auth interface uniform. Any client that can send Bearer tokens can use API keys without code changes.
- **keyPrefix stores first 8 chars**: `crb_` plus 4 hex chars gives enough for visual identification in logs and listings without exposing sensitive material.
- **No permission check on API key endpoints**: Any authenticated user can manage their own keys. This matches the "solo developer" user persona — no need for admin approval to create API keys. The userId filtering ensures users can only see/revoke their own keys.
- **User context sets iat: 0, exp: 0 for API keys**: Since API keys don't have time-based claims, these are set to zero. The user context interface `{ sub, iat, exp }` was designed for JWT payloads, and zero values indicate "not applicable" without changing the type.

## Plan Deviations
Implementation followed the plan as written. All 7 steps executed in order.

## Test Results
- Step 1 (pnpm test): PASS — 189 tests (150 API + 39 dashboard), zero failures
- Test: "creates an API key and returns it": PASS — verifies 201, crb_ prefix, keyPrefix matches first 8 chars
- Test: "creates unique keys for different names": PASS — two keys have different values
- Test: "returns 400 if name is missing": PASS
- Test: "returns 401 without auth": PASS
- Test: "lists all keys for authenticated user": PASS — verifies no key/keyHash in response
- Test: "returns empty array when user has no keys": PASS
- Test: "does not show keys from other users": PASS — alice and bob only see their own
- Test: "revokes a key": PASS — 200 with "API key revoked" message
- Test: "shows revokedAt after revocation": PASS
- Test: "returns 404 for another user's key": PASS
- Test: "returns 404 for non-existent key": PASS
- Test: "authenticates with valid API key": PASS — API key used as Bearer token, 200 response
- Test: "rejects revoked API key": PASS — 401 after revocation
- Test: "rejects invalid API key": PASS — 401 for crb_invalidkey
- Test: "JWT auth still works alongside API key auth": PASS — both auth methods on same endpoint
- Test: "logs api_key_created event": PASS — audit log has correct eventType and metadata
- Test: "logs api_key_revoked event": PASS — audit log has correct eventType, keyId, keyPrefix

No test failures. No fix→retest cycles needed.

## Challenges and Learnings

### Challenges
- No significant challenges. The existing codebase patterns (Hono middleware, Drizzle ORM, Web Crypto API, vitest with in-memory SQLite) are well-established and made the implementation straightforward.

### Learnings
- The auth middleware extension pattern (prefix detection → branch) is clean and extensible. Future auth methods (e.g., OAuth tokens, session cookies) could follow the same pattern.
- API keys that share the same Bearer header as JWTs mean the existing useApiFetch hook and Authorization header injection in the dashboard would work with API keys too, though dashboard API key management UI is out of scope.

## Product Insights
- API key management completes the "service-to-service authentication" feature listed in product.md. The remaining unimplemented product feature gap is now smaller — API key scopes/permissions and dashboard UI for key management are the natural next steps but were explicitly out of scope.
- The audit logs page's hardcoded event type dropdown now needs updating to include `api_key_created` and `api_key_revoked` — this is a known maintenance pattern noted in Position.

## Notes for REFLECT
- All 5 success criteria met. No assumptions proved wrong.
- The project now has 9 tables (api_keys is the newest), 3 auth methods (JWT, refresh token, API key), and 189 tests.
- The audit logs dropdown in the dashboard needs manual update to include the 2 new event types (api_key_created, api_key_revoked) — same pattern as noted for previous event type additions.
- Next logical steps: API key scopes/permissions, dashboard UI for key management, or shifting to a different Goal area.
- No technical debt introduced. The implementation is clean and follows all established patterns.
