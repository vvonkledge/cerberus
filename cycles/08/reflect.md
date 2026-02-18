# Reflect — Cycle 08

## What Worked

- In-memory SQLite test setup works cleanly with many-to-many join tables — the flagged risk about role_permissions and user_roles didn't materialize
- Drizzle ORM handles multi-table inner joins well for the permission resolution query (userRoles → rolePermissions → permissions)
- Normalizing permissions into a dedicated table (rather than inline strings) enables future enumeration and prevents typo drift
- Idempotent permission assignment (upsert pattern) simplifies the API contract

## What Didn't Work

- Lint (biome) caught import ordering and line length issues in all 4 new RBAC files — required a separate fix pass after implementation
- Pre-existing lint issues in login.ts and refresh.test.ts remain unaddressed — technical debt accumulating
- Test boilerplate is growing: each test file duplicates the full CREATE_TABLES SQL for all 7 tables, which will get heavier as more tables are added

## What Changed in Understanding

No significant changes in understanding this cycle.

## Product Changes

No product definition changes this cycle.
