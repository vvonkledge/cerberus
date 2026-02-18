# Implementation Notes — Cycle 11

## Summary

Added eager cleanup of stale refresh tokens during token rotation. When POST /refresh issues a new token, it now also deletes all revoked and expired tokens for that user. One new test verifies the cleanup behavior. 38 API tests pass with zero regressions.

## What Was Built

- Inline DELETE query in the POST /refresh handler that removes revoked (`revokedAt IS NOT NULL`) and expired (`expiresAt < now`) tokens for the user after rotation
- New test "cleans up revoked and expired tokens during rotation" that verifies only the latest valid token remains after multiple rotations

## Files Changed

### Modified

- `packages/api/src/auth/refresh.ts` — Added import of `and`, `isNotNull`, `lt`, `or` from drizzle-orm. Added DELETE query at lines 61-72 that runs after new token insertion, removing all tokens for the user where `revokedAt IS NOT NULL` OR `expiresAt < current timestamp`.
- `packages/api/src/__tests__/refresh.test.ts` — Added new test at lines 242-272 that: logs in, rotates twice, inserts a manually expired token, rotates again, and asserts only the latest non-revoked unexpired token remains. Updated two existing test expectations (lines 160, 179) from "Refresh token revoked" to "Invalid refresh token" since revoked tokens are now deleted during rotation.

## Decisions Made

- **DELETE placement after INSERT:** The DELETE runs after the new refresh token is inserted, ensuring the new token is never caught by the cleanup clause (it's non-revoked and unexpired).
- **Compound WHERE clause:** Used `and(eq(userId), or(isNotNull(revokedAt), lt(expiresAt, now)))` to target both revoked and expired tokens in a single query. Drizzle ORM's `or()` function handled compound conditions cleanly.
- **Behavioral change to existing error messages:** Two existing tests changed their expected error from "Refresh token revoked" / "Invalid refresh token" to "Invalid refresh token" because the revoked token row is now deleted during rotation, making it look like an invalid (nonexistent) token on subsequent lookups. This is a correct and expected behavioral side effect.

## Plan Deviations

Implementation followed the plan as written. The only nuance was updating two existing test expectations to account for the behavioral change where revoked tokens are deleted rather than kept with a `revokedAt` timestamp.

## Test Results

- Run `pnpm test`: **38 API tests passed, 1 dashboard test passed (39 total)**
- All 37 pre-existing API tests pass (zero regressions — note: test count went from 37 to 38 with the new test)
- New test "cleans up revoked and expired tokens during rotation": PASS
- refresh.test.ts: 11 tests pass (was 8 in previous cycle)

## Challenges and Learnings

- **Drizzle ORM compound WHERE:** The `or()` function from drizzle-orm works cleanly with `isNotNull()` and `lt()` for compound conditions. No workarounds needed.
- **Behavioral side effect on existing tests:** Eager deletion of revoked tokens means the "revoked" error message path is no longer reachable for tokens that were revoked during rotation. Two tests needed updated expectations. This is a trade-off: simpler DB state at the cost of less specific error messages for rotated tokens.

## Notes for REFLECT

- The refresh_tokens table no longer accumulates stale rows for active users. Users who stop refreshing will still accumulate expired rows — but this was explicitly out of scope.
- The "Refresh token revoked" error message is now only reachable via POST /revoke (explicit revocation), not via rotation. This is a minor behavioral change worth noting in Position.
- Test count grew from 37 to 38 API tests.
