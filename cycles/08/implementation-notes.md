# Implementation Notes — Cycle 08

## Summary

Added the roles and permissions data model with four new database tables and four RBAC API endpoints. Users can now be assigned roles, roles can have permissions, and applications can resolve a user's full permission set. All 29 API tests pass with zero regressions.

## What Was Built

- Roles table, permissions table, role_permissions join table, and user_roles join table in the Drizzle schema
- POST /roles — create a role with name and description (201, 409 on duplicate, 400 on missing name)
- POST /roles/:roleId/permissions — assign a permission string to a role (200, idempotent, 404 on bad roleId)
- POST /users/:userId/roles — assign a role to a user (200, 404 on bad userId or roleId)
- GET /users/:userId/permissions — resolve all permissions from assigned roles via join query (200, deduplicates across roles)

## Files Changed

### Created

- `packages/api/src/rbac/roles.ts` — Hono sub-app for role creation and permission assignment
- `packages/api/src/rbac/user-roles.ts` — Hono sub-app for user-role assignment and permission resolution
- `packages/api/src/__tests__/roles.test.ts` — 5 tests for roles and role-permission endpoints
- `packages/api/src/__tests__/user-roles.test.ts` — 5 tests for user-role and permission resolution endpoints

### Modified

- `packages/api/src/db/schema.ts` — added roles, permissions, rolePermissions, userRoles tables
- `packages/api/src/index.ts` — registered /roles and /users routes

## Decisions Made

- Permission strings are stored in a dedicated permissions table (normalized) rather than inline in role_permissions. This enables future permission enumeration and prevents typo-based permission drift.
- The POST /roles/:roleId/permissions endpoint upserts permissions — if the permission string already exists in the permissions table, it reuses it. The role-permission link is idempotent.
- User-roles routes are mounted at /users (e.g., /users/:userId/roles, /users/:userId/permissions) rather than a separate /user-roles prefix, since the resources are user-scoped.
- Permission resolution uses a three-way inner join (user_roles → role_permissions → permissions) with deduplication via Set, handling the case where multiple roles grant the same permission.

## Plan Deviations

Implementation followed the plan as written. The only addition was auto-fixing lint issues (import sorting and line formatting) in the new files after initial implementation.

## Test Results

- Step 1 (full suite): PASS — 29 API tests + 1 dashboard test
- Step 2 (19 existing tests): PASS — zero regressions
- Step 3 (POST /roles 201): PASS
- Step 4 (duplicate role 409): PASS
- Step 5 (assign permission 200): PASS
- Step 6 (bad roleId 404): PASS
- Step 7 (assign role to user 200): PASS
- Step 8 (bad userId 404): PASS
- Step 9 (resolve permissions): PASS
- Step 10 (empty permissions): PASS
- Step 11 (total count increased): PASS — 19 existing + 10 new = 29

## Challenges and Learnings

- Challenge: Lint (biome) import ordering and line length rules caught formatting issues in all 4 new RBAC files. Resolved with `biome check --fix --unsafe` targeting only the new files.
- Learning: The in-memory SQLite test setup works cleanly with many-to-many join tables — no issues with the role_permissions and user_roles tables as was flagged as a risk.
- Learning: Drizzle ORM handles multi-table inner joins well for the permission resolution query (userRoles → rolePermissions → permissions).

## Notes for REFLECT

- The RBAC data model is now in place but no endpoints are auth-protected — any caller can create roles and assign permissions. Admin-only access control is the natural next step.
- The /users route prefix is now shared between user-roles and potentially future user management endpoints. This may need namespacing if user CRUD is added later.
- Pre-existing lint issues remain in login.ts (formatting) and refresh.test.ts (non-null assertions) — not introduced by this cycle.
