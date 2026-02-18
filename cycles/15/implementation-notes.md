# Implementation Notes — Cycle 15

## Summary
Added 27 E2E tests across 3 journey-based test files that validate all user-facing API workflows. Tests chain real API calls in realistic sequences: new-user lifecycle, admin setup with full RBAC operations, and comprehensive error paths. All 85 tests pass (58 existing + 27 new) with zero regressions and zero flakiness across two consecutive runs.

## What Was Built
- **new-user-journey.e2e.test.ts** (1 test): A single comprehensive test that chains register → login → verify JWT → refresh token → verify new JWT → revoke token → confirm revoked token rejected. Tests the complete auth lifecycle as a new user would experience it.
- **admin-setup-journey.e2e.test.ts** (9 tests): Tests the full admin setup flow: register a user → login → seed admin role → verify seed idempotency (409 on duplicate) → list roles with permissions → create new role → assign permission to role → list roles showing new role → register second user → list users → assign role to user → resolve user permissions → verify admin permissions. Each test is self-contained (re-does setup in beforeEach) to avoid inter-test coupling.
- **error-paths.e2e.test.ts** (17 tests): Three describe blocks covering authentication errors (invalid password, nonexistent user, duplicate registration, missing fields), token errors (expired tokens, revoked tokens, garbage tokens, already-rotated tokens), and authorization errors (no auth header → 401, invalid JWT → 401, valid JWT but no permission → 403 for both /roles and /users endpoints).

## What Worked
- **Parallel worker decomposition worked perfectly**: 3 workers each owning one independent test file with no shared files or dependencies. All 3 completed their files without conflicts or coordination issues. The journey-based file organization (new-user, admin-setup, error-paths) mapped cleanly to independent work streams.
- **Existing test patterns provided a strong template**: Every existing test file follows the same setup pattern (in-memory SQLite + Hono test client + beforeEach isolation), making it straightforward for workers to replicate the pattern for E2E tests. No new infrastructure or test utilities were needed.
- **In-memory SQLite isolation per test**: Using `createDatabase({ url: "file::memory:" })` in beforeEach gave each test a clean database, completely eliminating the test pollution risk identified in the plan. No shared state between tests or between test files.
- **Rate limiting was a non-issue**: The identified risk of rate limiting blocking rapid test calls never materialized. E2E tests don't use the rate-limiter middleware (routes are mounted directly without rate limiter wrappers), and the test count per endpoint stays well within limits anyway.

## What Didn't Work
- No significant blockers encountered. Implementation proceeded as planned. The admin-setup-journey tests have notable setup repetition (each test re-registers, seeds, and logs in) because beforeEach resets the DB — this is a trade-off for test isolation over DRY. An alternative would have been a single long chained test (like new-user-journey), but separate tests give better error locality.

## Files Changed

### Created
- `packages/api/src/__tests__/new-user-journey.e2e.test.ts` — E2E test for complete new-user auth lifecycle (register → login → refresh → revoke)
- `packages/api/src/__tests__/admin-setup-journey.e2e.test.ts` — E2E test for admin setup journey with full RBAC operations (seed → roles → permissions → user-roles → permission resolution)
- `packages/api/src/__tests__/error-paths.e2e.test.ts` — E2E test for error scenarios across auth, token, and authorization paths

### Modified
- No existing files were modified.

## Decisions Made
- **Journey-based file organization over endpoint-based**: Chose to organize by user journey (new-user, admin-setup, error-paths) rather than by endpoint domain (auth.e2e.ts, rbac.e2e.ts). This makes each test file tell a coherent story and tests the integration between endpoints, which is the whole point of E2E tests.
- **Self-contained tests in admin-setup over shared state**: The admin-setup-journey file uses self-contained tests that each re-do their setup (register → seed → login) rather than sharing state across tests. The alternative was one big chained test like new-user-journey. Chose self-contained tests for better error locality and independence, at the cost of some setup repetition.
- **Mounted routes directly without rate limiter**: E2E tests mount route handlers directly (like existing unit tests) rather than importing the production app from index.ts. This avoids rate limiting interference and the ASSETS binding issue. The trade-off is that E2E tests don't test the exact production wiring, but they do test the actual route handlers, middleware, and database layer — which is the valuable integration layer.
- **Error-paths uses real user registration + login for 403 tests**: Rather than using signJwt to craft test tokens (like existing unit tests do), the error-paths file registers a real user, logs in to get a real JWT, then uses that JWT against protected endpoints. This tests the true end-to-end authorization flow.

## Plan Deviations
- Implementation followed the plan as written. The 3 test files map directly to plan steps 2, 3, and 4.

## Test Results
- Test run 1: 85 tests passed, 0 failed (12 test files, 1.34s)
- Test run 2: 85 tests passed, 0 failed (12 test files, 1.24s)
- Zero flakiness confirmed across both runs
- Breakdown: 58 existing tests + 1 (new-user-journey) + 9 (admin-setup-journey) + 17 (error-paths) = 85 total

### Success Criteria Coverage
| Criterion | Status | Evidence |
|---|---|---|
| E2E tests cover full workflows: register, login, refresh, revoke, seed, role creation, permission assignment, user-role assignment, and permission resolution | PASS | new-user-journey covers register/login/refresh/revoke; admin-setup-journey covers seed/role creation/permission assignment/user-role assignment/permission resolution |
| Tests cover both happy paths and error paths (invalid credentials, expired tokens, unauthorized access, duplicate registration) | PASS | new-user-journey and admin-setup-journey cover happy paths; error-paths covers invalid credentials (tests 1-2), expired tokens (test 1), revoked tokens (test 2), unauthorized access 401 (tests 1-4), forbidden 403 (tests 5-6), duplicate registration (test 3) |
| All existing 58 API tests continue to pass with zero regressions | PASS | 85 total = 58 existing + 27 new, all passing |

## Challenges and Learnings

### Challenges
- The admin-setup-journey required mounting all routes with proper middleware stacking (auth + authorization) matching the production wiring in index.ts. This required careful reading of the existing test patterns in roles.test.ts and user-roles.test.ts.

### Learnings
- The existing test infrastructure is well-suited for E2E testing without any new tooling — the Hono test client + in-memory SQLite pattern scales well from unit tests to integration/E2E tests.
- Each E2E test file takes ~50-300ms, adding minimal overhead to the test suite (total suite still under 1.5s).

## Product Insights
- The POST /seed endpoint being unauthenticated is a deliberate design choice that simplifies bootstrapping but is a security consideration for production — the 409 guard prevents re-seeding but doesn't prevent unauthorized first seeding.
- The authorization model works correctly end-to-end: a freshly registered user with no roles gets 403 on all RBAC endpoints, confirming the default-deny posture.

## Notes for REFLECT
- All 3 success criteria are fully met with strong evidence.
- No new technical debt was introduced — only test files were added.
- The test suite is now comprehensive enough to serve as a safety net for future changes.
- The project is in good shape for the next cycle — likely dashboard authentication or password reset, as those are the remaining product features.
- Current test count: 85 (up from 58).
