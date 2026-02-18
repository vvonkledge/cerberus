# Plan — Cycle 15

## Approach

Organize E2E tests by user journey rather than endpoint domain. Create separate test files that chain real API calls in realistic sequences: a new-user journey (register → login → refresh → revoke), an admin-setup journey (register → login → seed → RBAC operations), and an error-paths file covering invalid credentials, expired tokens, unauthorized access, and duplicate registration. Use the existing Vitest + in-memory SQLite test infrastructure.

## Steps

1. Review existing test files to understand the app setup pattern, imports, test helpers, and how the Hono test client is used
2. Create `new-user-journey.e2e.test.ts` — tests that chain: register a user → login → refresh the token → revoke the refresh token
3. Create `admin-setup-journey.e2e.test.ts` — tests that chain: register a user → login → seed admin role → create roles → assign permissions to roles → assign roles to users → resolve user permissions
4. Create `error-paths.e2e.test.ts` — tests covering: invalid credentials on login, expired/revoked tokens on refresh, unauthorized access (401 without token, 403 without permission), duplicate registration
5. Run the full test suite (`pnpm --filter api test`) to confirm all existing 58 tests plus new E2E tests pass with zero regressions

## How to Test It

1. Run `pnpm --filter api test` — verify all tests pass (existing 58 + new E2E tests)
2. Check `new-user-journey.e2e.test.ts` exists and contains tests for: register, login, refresh, revoke
3. Check `admin-setup-journey.e2e.test.ts` exists and contains tests for: seed, role creation, permission assignment, user-role assignment, permission resolution
4. Check `error-paths.e2e.test.ts` exists and contains tests for: invalid credentials, expired tokens, unauthorized access (401/403), duplicate registration
5. Verify total test count increased beyond 58 (existing tests + new E2E tests)
6. Run tests a second time to confirm no flakiness

## Risks and Unknowns

- Risk: Rate limiting on auth endpoints (login 10/60s, register 5/60s, refresh 10/60s) may block rapid E2E test calls — mitigation: may need to account for rate limit state between tests or use unique users per test
- Risk: Journey tests share database state across steps within a journey — risk of test pollution if one journey's data leaks into another — mitigation: use unique email addresses per test file and fresh app instances

## First Move

Read the existing test files (e.g., `packages/api/src/__tests__/`) to understand the app creation pattern, database setup, imports, and how the Hono test client is configured before writing any new test files.
