# Reflect — Cycle 15

## What Worked

- Journey-based test file organization (new-user, admin-setup, error-paths) mapped cleanly to independent parallel work streams — 3 workers completed without conflicts or coordination overhead.
- Existing Hono test client + in-memory SQLite setup pattern replicated directly for E2E tests with zero new infrastructure or test utilities needed.
- In-memory SQLite with beforeEach isolation eliminated the test pollution risk identified in the plan — no shared state between tests or test files.
- Rate limiting interference (a planned risk) never materialized because E2E tests mount route handlers directly without rate limiter middleware wrappers.
- Using real user registration + login for authorization error tests (rather than manually crafted JWTs) validated the true end-to-end authorization flow, confirming default-deny posture.

## What Didn't Work

- No significant blockers encountered. Implementation proceeded as planned with zero deviations.
- The admin-setup-journey tests have notable setup repetition (each test re-registers, seeds, and logs in) because beforeEach resets the DB. This is a deliberate trade-off for test isolation over DRY — separate tests give better error locality than one long chained test.

## What Changed in Understanding

No significant changes in understanding. Implementation validated the planned approach. The Hono test client + in-memory SQLite pattern scales well from unit tests to E2E tests without new tooling, and the full test suite remains under 1.5s even with 27 new tests. The E2E tests confirmed that the authorization model works correctly end-to-end: a freshly registered user with no roles gets 403 on all RBAC endpoints, and the seed → role → permission → user-role → permission-resolution chain works as designed.

## Product Changes

No product definition changes this cycle. Two observations worth noting for future consideration: (1) POST /seed being unauthenticated simplifies bootstrapping but means anyone can seed the first admin role — the 409 guard prevents re-seeding but not unauthorized first seeding; (2) the default-deny authorization posture is confirmed working correctly end-to-end.
