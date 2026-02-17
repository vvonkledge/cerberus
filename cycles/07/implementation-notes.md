# Implementation Notes — Cycle 07

## Summary
Added refresh token support to the auth system. Users now receive an opaque refresh token alongside their JWT access token on login. The refresh token can be used to obtain new access tokens without re-entering credentials, and can be revoked to invalidate sessions. All tokens are stored in Turso with 7-day expiry.

## What Was Built
- Refresh tokens table in the database schema
- Cryptographic refresh token generation using Web Crypto API
- POST /refresh endpoint to exchange refresh tokens for new access tokens
- POST /revoke endpoint to invalidate refresh tokens
- Updated POST /login to issue and return refresh tokens
- 7 new tests covering all refresh token flows

## Files Changed

### Created
- `packages/api/src/auth/refresh.ts` — POST /refresh endpoint: validates token against DB, checks expiry and revocation, returns new JWT
- `packages/api/src/auth/revoke.ts` — POST /revoke endpoint: marks refresh token as revoked with timestamp
- `packages/api/src/__tests__/refresh.test.ts` — 7 tests: happy path refresh, expired token, revoked token, invalid token, JWT validity, revoke success, 7-day expiry verification

### Modified
- `packages/api/src/db/schema.ts` — Added `refreshTokens` table (id, token, userId, expiresAt, revokedAt, createdAt)
- `packages/api/src/auth/crypto.ts` — Added `generateRefreshToken()` function using `crypto.getRandomValues`; exported `hexEncode` helper
- `packages/api/src/auth/login.ts` — Generates refresh token on successful login, stores in DB, returns in response alongside access_token
- `packages/api/src/index.ts` — Registered /refresh and /revoke routes
- `packages/api/src/__tests__/login.test.ts` — Added refresh_tokens table to test setup; updated login response assertion to include refresh_token

## Decisions Made
- Used opaque hex strings (32 random bytes → 64-char hex) for refresh tokens rather than JWTs, keeping them simple and revocable via DB lookup
- Exported the previously-private `hexEncode` helper from crypto.ts rather than duplicating the logic
- Expiry comparison in the refresh endpoint uses ISO string comparison which works correctly for ISO 8601 datetime strings

## Plan Deviations
Implementation followed the plan as written.

## Test Results
- Step 1 (run pnpm test): PASS — 19 tests total
- Step 2 (no regressions): PASS — all 12 original tests pass
- Step 3 (login returns both tokens): PASS
- Step 4 (refresh happy path): PASS
- Step 5 (expired token → 401): PASS
- Step 6 (revoke → 200): PASS
- Step 7 (revoked token → 401): PASS
- Step 8 (invalid token → 401): PASS
- Step 9 (7-day expiry in DB): PASS
- Step 10 (test count increased): PASS — 12 → 19

## Challenges and Learnings
- Workers needed explicit nudging to actually create files — teammate agents sometimes reported completion without writing to disk. Required verification and retry.
- The sequential dependency chain (schema → endpoints → tests → tester) limited parallelism, but was necessary due to shared file dependencies.

## Notes for REFLECT
- All 4 success criteria from define.md are met
- The `hexEncode` export is a minor API surface change in crypto.ts — future cycles should note this is now public
- Token rotation (issuing new refresh token on each refresh) was deliberately excluded per the out-of-scope list but would be a natural follow-up
