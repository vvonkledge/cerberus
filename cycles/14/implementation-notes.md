# Implementation Notes — Cycle 14

## Summary

Added role-based authorization to all RBAC endpoints. A `requirePermission` middleware checks user permissions via DB lookup and returns 403 when the required permission is missing. A seed endpoint (POST /seed) bootstraps an admin role with `manage_roles` and `manage_users` permissions. All 58 API tests pass (8 new 403 tests, 50 existing with zero regressions).

## What Was Built

- **requirePermission middleware** (`packages/api/src/middleware/authorization.ts`): A Hono middleware factory that takes a permission name, queries the DB via user_roles → role_permissions → permissions joins to check if the authenticated user has that permission, and returns 403 `{ error: "Forbidden" }` if not. Follows the same pattern as the existing auth middleware — reads user from Hono context, queries DB, gates access.

- **Seed endpoint** (`packages/api/src/rbac/seed.ts`): POST /seed accepts `{ userId }`, creates an "admin" role with `manage_roles` and `manage_users` permissions, assigns the role to the specified user, returns 201. Returns 409 if admin role already exists (idempotent guard). No auth required — this is a bootstrap mechanism.

- **Route wiring** (`packages/api/src/index.ts`): Added `requirePermission("manage_roles")` after `authMiddleware()` on rolesApp, and `requirePermission("manage_users")` after `authMiddleware()` on usersApp. Added seed route at `/seed` with no auth.

- **Test updates** (all 3 RBAC test files): Added requirePermission middleware to test app setup, seeded admin role/permissions in beforeEach so existing tests' JWT user (sub: "1") has required permissions. Added 8 new tests verifying 403 responses for unauthorized users across all RBAC endpoints.

## What Worked

- **Layered middleware pattern**: Adding requirePermission as a second middleware after authMiddleware was clean and composable. Auth middleware handles 401 (who are you?), authorization middleware handles 403 (what can you do?). No changes needed to the auth middleware or route handlers — the new middleware slots in between.

- **DB seeding approach in tests**: Using raw SQL inserts in beforeEach to seed admin role + permissions + user_roles was reliable and fast. The seeded role uses name `__seed__` to avoid name collisions with roles created by tests (e.g., tests that create an "admin" role for testing).

- **Permission name convention**: Using `manage_roles` and `manage_users` as coarse-grained permission names maps directly to the route groups (rolesApp, usersApp), keeping the mental model simple.

- **Two-worker decomposition**: Splitting into implementation worker (middleware + seed + wiring) and test worker (test updates + 403 tests) was the right decomposition. The implementation worker had clean file ownership, and the test worker could focus purely on test concerns.

## What Didn't Work

- **First test worker stalled**: The first test worker (test-worker) only partially completed its task — it updated roles.test.ts but left user-roles.test.ts and list-endpoints.test.ts untouched, and added no 403 tests. It appeared to stall or lose track of its task. A replacement worker (test-worker-2) was spawned with more explicit instructions and completed the full job correctly.

- **Test assertions needed adjustment for seeded data**: After adding admin seeding in beforeEach, tests like "returns empty array when no roles exist" and "returns roles with their permissions" needed to account for the seeded `__seed__` role. The list-endpoints.test.ts adjustments were the trickiest — the "empty array" test became "returns the seeded admin role" and the count in "returns roles with their permissions" went from 2 to 3.

## Files Changed

### Created
- `packages/api/src/middleware/authorization.ts` — requirePermission middleware that checks user permissions via DB and returns 403
- `packages/api/src/rbac/seed.ts` — POST /seed endpoint to bootstrap admin role with all permissions

### Modified
- `packages/api/src/index.ts` — wired requirePermission onto rolesApp and usersApp, added seed route
- `packages/api/src/__tests__/roles.test.ts` — added requirePermission to test app, admin seeding, 3 new 403 tests
- `packages/api/src/__tests__/user-roles.test.ts` — added requirePermission to test app, admin seeding (including seed user), 3 new 403 tests
- `packages/api/src/__tests__/list-endpoints.test.ts` — added requirePermission to test app, admin seeding, adjusted existing assertions for seeded data, 2 new 403 tests

## Decisions Made

- **Permission granularity**: Chose two coarse permissions (`manage_roles`, `manage_users`) rather than fine-grained per-action permissions (e.g., `roles:create`, `roles:read`, `roles:assign_permissions`). This matches the "out of scope" boundary — fine-grained per-resource permissions are deferred. The coarse approach is simpler and covers the use case.

- **Seed endpoint without auth**: The seed endpoint has no authentication because it's a bootstrap mechanism — you need it to create the first admin before any auth-protected operations work. The idempotent guard (409 if admin exists) prevents abuse after initial setup.

- **`__seed__` role name in tests**: Used `__seed__` instead of `admin` for the beforeEach-seeded role to avoid UNIQUE constraint conflicts with tests that create an "admin" role. This is a test-only concern — production uses the real seed endpoint which creates an "admin" role.

- **Raw SQL for test seeding**: Used raw SQL inserts rather than going through the seed endpoint or Drizzle ORM. This avoids coupling test setup to application code — if the seed endpoint breaks, tests still seed correctly.

## Plan Deviations

- Implementation followed the plan as written. The only deviation was operational — the first test worker needed to be replaced due to stalling.

## Test Results

- **Step 1 (pnpm test)**: PASS — 58 API tests, 1 dashboard test, all pass
- **Step 2 (TypeScript check)**: PASS — 46 pre-existing TS errors on main, no new errors introduced
- **Step 3 (Seed endpoint verification)**: PASS — 201 creation, 409 duplicate guard, 400 validation all work
- **Step 4 (403 test coverage)**: PASS — 8 new 403 tests across all RBAC endpoints
- **Step 5 (Middleware wiring)**: PASS — authorization middleware correctly chained after auth on both route groups
- **Step 6 (Test counts)**: PASS — 50 old + 8 new = 58 API tests

## Challenges and Learnings

### Challenges

- **Test worker reliability**: The first test worker stalled after partially completing work. Providing very explicit, step-by-step instructions (including exact code snippets) to the replacement worker solved this. Lesson: for test file modifications that need to be precise, providing exact code blocks is more reliable than high-level descriptions.

- **Seeded data vs test expectations**: Adding admin seeding changed assumptions about database state (auto-increment IDs, role counts). The list-endpoints.test.ts needed the most adjustment because its tests made exact count/equality assertions.

### Learnings

- Hono's middleware chaining pattern (`app.use("*", mw1); app.use("*", mw2)`) works cleanly for layered auth+authorization. Middleware executes in order, so auth (401) fires before authorization (403).
- Test apps in this codebase construct their own Hono app separately from index.ts. This means test files need to mirror any middleware changes from index.ts — there's no single source of truth for route configuration in tests.
- The pre-existing codebase has 46 TypeScript errors (from main branch). These are not related to this cycle's changes.

## Product Insights

- The seed endpoint is unauthenticated and lacks rate limiting — this is fine for a solo-developer tool but would need protection in a multi-tenant scenario. The idempotent guard prevents re-seeding but doesn't prevent brute-force attempts.
- Authorization is now enforced at the API level but NOT in the dashboard. A user without permissions can still navigate the dashboard UI and see forms — they'll just get 403 errors when submitting. Dashboard auth is the logical next step.

## Notes for REFLECT

- Position should reflect: RBAC endpoints are now both authenticated (401) AND authorized (403). The authorization uses coarse permissions (manage_roles, manage_users) via a requirePermission middleware. A seed endpoint bootstraps the admin role.
- The 46 pre-existing TypeScript errors should be noted — they existed before this cycle and are unrelated.
- Test apps in the codebase mirror the production middleware chain but maintain separate configuration. This duplication is a mild risk for drift.
- Next cycle candidates: dashboard authentication, token cleanup for inactive users, or fine-grained permissions.
