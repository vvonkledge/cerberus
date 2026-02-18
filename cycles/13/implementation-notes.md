# Implementation Notes — Cycle 13

## Summary

Added JWT auth middleware that protects all RBAC endpoints. Requests without a valid JWT now receive 401. All existing tests updated to include Bearer tokens, and 6 new tests verify unauthenticated access is rejected. 51 total tests pass with zero regressions.

## What Was Built

- Auth middleware that extracts JWT from Authorization: Bearer header and verifies via existing `verifyJwt()` function
- Applied middleware to /roles and /users route groups using the established sub-app pattern
- Updated existing RBAC tests to send valid JWTs
- Added 6 new tests: 401 for missing auth header (roles, users) and 401 for invalid JWT (roles, users)

## Files Changed

### Created

- `packages/api/src/middleware/auth.ts` — Auth middleware: extracts Bearer token, verifies JWT, returns 401 if missing/invalid, sets user context if valid

### Modified

- `packages/api/src/index.ts` — Added `user` to Variables type, imported authMiddleware, wrapped /roles and /users routes in sub-apps with auth middleware
- `packages/api/src/__tests__/roles.test.ts` — Added `signJwt` import, generate valid token in tests, added Authorization headers to all RBAC requests, added 3 new tests (401 without auth, 401 for POST without auth, 401 with invalid JWT)
- `packages/api/src/__tests__/user-roles.test.ts` — Added `signJwt` import, generate valid token in tests, added Authorization headers to all RBAC requests, added 3 new tests (401 for GET /users, 401 for POST /users/:id/roles, 401 with invalid JWT)
- `packages/api/src/__tests__/list-endpoints.test.ts` — Updated to account for auth middleware on RBAC endpoints

## Decisions Made

- Used the existing sub-app pattern (same as rate-limited routes) rather than inventing a new middleware application pattern — consistency with existing codebase
- Auth middleware returns JSON error bodies (`{ error: "Authorization required" }` and `{ error: "Invalid token" }`) matching the existing error response style
- Set verified JWT payload on Hono context as `user` variable for downstream route handlers to access if needed

## Plan Deviations

Implementation followed the plan as written. The `list-endpoints.test.ts` file also needed updates (not anticipated in plan) since it tests endpoint responses directly and RBAC routes now require auth.

## Test Results

- Test 1 (pnpm test — all pass): PASS — 51 tests pass (50 API + 1 dashboard)
- Test 2 (new 401 tests without auth header): PASS — 4 tests across roles.test.ts and user-roles.test.ts
- Test 3 (new 401 tests with invalid JWT): PASS — 2 tests across roles.test.ts and user-roles.test.ts
- Test 4 (existing tests use Bearer tokens): PASS — all RBAC requests include Authorization: Bearer header
- Test 5 (final pnpm test): PASS — 51 tests pass

## Challenges and Learnings

- The `list-endpoints.test.ts` file was an unexpected dependency — it tests raw endpoint responses and needed auth headers added for RBAC routes. This is a minor plan deviation but was handled cleanly by the worker.
- The sub-app middleware pattern used for rate limiting transferred perfectly to auth — wrapping route groups in sub-apps with `use("*", middleware)` is a clean, consistent pattern for Hono.

## Notes for REFLECT

- RBAC endpoints are now authenticated but not authorized — any valid JWT grants full access. Role-based authorization (403 for non-admins) is the natural next step.
- The `user` context variable is now available in RBAC route handlers, which will be needed when role-based authorization is added.
- Test count grew from 45 to 51 (6 new tests).
