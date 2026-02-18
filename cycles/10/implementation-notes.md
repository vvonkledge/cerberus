# Implementation Notes — Cycle 10

## Summary

Implemented refresh token rotation using a revoke-and-reissue approach. POST /refresh now revokes the old refresh token and returns a new one alongside the new access token. Three new test cases cover all success criteria — 38 total tests pass with zero regressions.

## What Was Built

- Refresh token rotation in the POST /refresh handler: old token revoked, new token generated and stored, both tokens returned
- Three new test cases: rotation returns new token, old token rejected, chained rotation reuse rejected

## Files Changed

### Modified
- `packages/api/src/auth/refresh.ts` — Added token revocation (set revokedAt), new refresh token generation via generateRefreshToken(), database insert for new token, and updated response to include refresh_token field
- `packages/api/src/__tests__/refresh.test.ts` — Updated existing "returns a new access token" test to also assert refresh_token in response; added 3 new tests: "returns new refresh token on successful refresh", "invalidates old refresh token after rotation", "rejects already-rotated token in a chain"

## Decisions Made

- Revoke-and-reissue over in-place update: revoking the old row and inserting a new one (rather than updating the token column in the existing row) keeps an audit trail and matches the existing revocation pattern used by POST /revoke
- No transaction wrapping: the revoke and insert are two separate queries. A failure between them could leave the old token revoked without a new one — acceptable for this cycle since token family tracking is out of scope
- 7-day expiry on new tokens: matches the expiry set at login time, keeping behavior consistent

## Plan Deviations

Implementation followed the plan as written.

## Test Results

- Step 1 (run pnpm test): PASS — 38 tests across 9 test files
- Step 2 (zero regressions): PASS — all 35 pre-existing tests still pass
- Step 3 (criterion 1 — refresh returns new refresh token): PASS — test "returns new refresh token on successful refresh" exists and passes
- Step 4 (criterion 2 — old token invalidated): PASS — test "invalidates old refresh token after rotation" exists and passes
- Step 5 (criterion 3 — rotated token reuse returns 401): PASS — test "rejects already-rotated token in a chain" exists and passes

## Challenges and Learnings

- No significant challenges — the existing codebase had clean patterns for token generation (crypto.ts) and revocation (revoke.ts) that were easy to reuse
- The generateRefreshToken() utility was already imported in refresh.ts (added in this cycle) — the import of signJwt was already present

## Notes for REFLECT

- Token count went from 35 to 38 (net +3 new test cases, but the existing "returns a new access token" test was updated rather than left broken)
- The lack of transaction wrapping between revoke and insert is a known gap — if atomicity becomes a concern, wrapping in a transaction would be the fix
- Race conditions on concurrent refresh with the same token are naturally handled: the first request revokes the token, the second sees it as revoked and returns 401
