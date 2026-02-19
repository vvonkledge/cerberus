# Implementation Notes — Cycle 21

## Summary

Implemented password reset with two new API endpoints (POST /forgot-password and POST /reset-password), a new `password_reset_tokens` database table, and full audit logging. All 6 success criteria met with 162 tests passing (13 new, 149 existing), zero regressions.

## What Was Built

- **`password_reset_tokens` table** — new Drizzle schema table with id, token (unique), userId, expiresAt, usedAt (nullable for single-use tracking), and createdAt columns. Mirrors the `refreshTokens` table pattern exactly.

- **POST /forgot-password** — accepts `{ email }`, looks up user by email, generates an opaque 32-byte hex token via Web Crypto `generateRefreshToken()`, stores it with 1-hour expiry, returns `{ resetToken }`. For non-existent emails, returns 200 with a generic message (no token) to prevent user enumeration. Writes `password_reset_requested` audit log entry for both cases.

- **POST /reset-password** — accepts `{ token, newPassword }`, validates token (exists, not expired via ISO string comparison, not used via `usedAt === null`), hashes new password with PBKDF2 via `hashPassword()`, updates the user's `hashedPassword` and `updatedAt`, marks token as used by setting `usedAt`, writes `password_reset_completed` audit log. On failure (invalid/expired/used token), writes `password_reset_failed` with reason in metadata and returns 400.

- **Route registration** — both endpoints registered as public routes in `index.ts` (no auth middleware, no rate limiting — both out of scope per define.md).

- **13 test cases** — covering: forgot-password happy path (registered email returns token), non-existent email returns 200 without token, missing email returns 400, audit log written for forgot-password, reset-password happy path, login with new password works, login with old password fails (401), used token rejected (400), expired token rejected (400, via manual DB update of expiresAt to past), invalid token rejected (400), missing fields returns 400, audit log written for completed reset, audit log written for failed reset.

## What Worked

- **Following the refresh token pattern exactly** was the right call. The `refreshTokens` table structure, `generateRefreshToken()` for opaque token generation, and `hashPassword()`/`verifyPassword()` for PBKDF2 were all reusable without modification. This made the implementation straightforward and consistent with existing code.

- **User enumeration prevention via uniform 200 responses** was clean to implement — the handler branches on user existence but always returns 200, just with different response bodies (token present vs generic message).

- **Existing test patterns** transferred directly to the new test file. The in-memory SQLite + raw CREATE TABLE + Hono test app pattern from `register.test.ts` worked perfectly. Adding the `password_reset_tokens` CREATE TABLE was the only new SQL needed.

- **Audit logging via `writeAuditLog`** was trivial to add — the existing best-effort wrapper with `getClientIp()` helper worked perfectly for all 4 event types (password_reset_requested, password_reset_completed, password_reset_failed with reasons in metadata).

- **Expired token testing via direct DB manipulation** — using Drizzle's `update().set({ expiresAt: pastDate })` in the test gave precise control over expiry testing without needing to mock time or wait.

## What Didn't Work

No significant blockers encountered. Implementation proceeded as planned. The only minor point: the ISO string comparison for expiry checking (`row.expiresAt < new Date().toISOString()`) works because ISO 8601 strings sort lexicographically, but this is an implicit assumption inherited from the refresh token pattern rather than an explicit design choice.

## Files Changed

### Created
- `packages/api/src/auth/forgot-password.ts` — POST /forgot-password handler with user lookup, token generation, and audit logging
- `packages/api/src/auth/reset-password.ts` — POST /reset-password handler with token validation, password update, and audit logging
- `packages/api/src/__tests__/password-reset.test.ts` — 13 test cases covering happy path, error cases, single-use enforcement, expiry, and audit logging

### Modified
- `packages/api/src/db/schema.ts` — added `passwordResetTokens` table definition
- `packages/api/src/index.ts` — registered /forgot-password and /reset-password routes as public endpoints

## Decisions Made

- **1-hour token expiry** — chose 1 hour as a reasonable balance between usability and security. Short enough to limit exposure window, long enough for a user to check their email (when email delivery is added in a future cycle). The expiry duration is hardcoded in forgot-password.ts (`60 * 60 * 1000`).

- **Reuse `generateRefreshToken()` for reset tokens** — rather than creating a separate token generation function, reused the existing 32-byte hex token generator. Same security properties, zero code duplication. The function name is slightly misleading in this context but the behavior is identical.

- **Uniform error messages for all reset failures** — all failure modes (invalid, expired, used) return the same `"Invalid or expired reset token"` message to avoid leaking information about token state to attackers. The specific reason is only recorded in the audit log metadata.

- **Public endpoints (no auth/rate limiting)** — per define.md out-of-scope items, both endpoints are registered without auth middleware or rate limiting. Rate limiting for these endpoints is a natural future cycle.

## Plan Deviations

Implementation followed the plan as written. The only implicit decision was choosing 1-hour expiry (the plan listed this as "Unknown: decide during implementation").

## Test Results

- Step 1 (regression): PASS — all 149 existing tests pass
- Step 2 (forgot-password valid email): PASS — 200 with resetToken string
- Step 3 (forgot-password non-existent email): PASS — 200 with message, no resetToken
- Step 4 (reset-password valid token): PASS — 200 response
- Step 5 (login old password): PASS — 401 response
- Step 6 (login new password): PASS — 200 with access_token
- Step 7 (used token): PASS — 400 response
- Step 8 (expired token): PASS — 400 response (via DB manipulation of expiresAt)
- Step 9 (invalid token): PASS — 400 response
- Step 10 (audit logs): PASS — password_reset_requested and password_reset_completed entries found
- Step 11 (final run): PASS — 162 tests total (133 API + 29 dashboard), all passing

## Challenges and Learnings

### Challenges
No significant challenges. The well-established patterns from previous cycles (refresh tokens, audit logging, test setup) made this cycle's implementation predictable.

### Learnings
- The project's pattern of opaque hex tokens + ISO timestamp expiry + single-use via nullable "usedAt" column is a clean, reusable pattern that applies to any token-gated operation (not just refresh or reset).
- Keeping all failure responses identical ("Invalid or expired reset token") while logging specific reasons in audit metadata is a good security pattern — user-facing messages reveal nothing, but the audit trail has full detail.

## Product Insights

- The forgot-password endpoint currently returns the reset token directly in the response body. This is fine for API-only usage (and explicitly out-of-scope for email), but when email delivery is added, the response should change to always return the generic message (never the token) since the token would be sent via email instead. The current API contract will need a breaking change at that point.
- Password reset is the first feature that modifies a user's credentials after initial registration. This establishes a pattern for future credential-change operations (e.g., change password while logged in, update email).

## Notes for REFLECT

- All 6 success criteria from define.md are met and verified by automated tests.
- The project now has 162 passing tests (133 API + 29 dashboard).
- The password reset feature is API-complete but not user-complete — no email delivery, no dashboard UI, no rate limiting. These are natural follow-up cycles.
- The 1-hour expiry is hardcoded; a future cycle might want to make this configurable.
- No technical debt introduced — the implementation follows all existing patterns cleanly.
- The "Password reset" feature from product.md is now partially implemented (API layer done, delivery/UI pending).
