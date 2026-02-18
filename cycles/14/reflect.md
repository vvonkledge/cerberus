# Reflect — Cycle 14

## What Worked

- Layered middleware pattern: adding `requirePermission` as a second middleware after `authMiddleware` was clean and composable — auth handles 401 (who are you?), authorization handles 403 (what can you do?). No changes were needed to the existing auth middleware or route handlers.
- Coarse permission names (`manage_roles`, `manage_users`) mapping directly to route groups kept the mental model simple and matched the defined scope boundary.
- Raw SQL seeding in test `beforeEach` with a `__seed__` role name avoided coupling test setup to application code and prevented UNIQUE constraint collisions with tests that create an "admin" role.
- Two-worker decomposition (implementation worker for middleware/seed/wiring, test worker for all test files) provided clean file ownership and separation of concerns.

## What Didn't Work

- The first test worker stalled after partially completing its task (updated one test file, left two untouched, added no 403 tests). A replacement worker with more explicit instructions — including exact code snippets rather than high-level descriptions — completed the full job. Lesson: precise, copy-pasteable instructions are more reliable than abstract task descriptions for test file modifications.
- Adding admin seeding in `beforeEach` shifted database state assumptions (auto-increment IDs, role counts). Tests with exact count/equality assertions (especially in list-endpoints.test.ts) needed adjustment — "returns empty array when no roles exist" became "returns the seeded admin role" and role counts increased by one.

## What Changed in Understanding

Hono's middleware chaining (`app.use("*", mw1); app.use("*", mw2)`) works cleanly for layered auth+authorization with middleware executing in declared order. Test apps in this codebase construct their own Hono app separately from `index.ts`, which means test files must mirror any middleware changes independently — there is no single source of truth for route configuration across production and test code. This duplication is a mild drift risk. The codebase has 46 pre-existing TypeScript errors on the main branch, unrelated to this cycle.

## Product Changes

No product definition changes this cycle. The observation that the seed endpoint is unauthenticated and the dashboard lacks authorization enforcement are operational concerns, not product scope changes — dashboard authentication was explicitly out of scope and remains a candidate for a future cycle.
