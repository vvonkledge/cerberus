# Plan — Cycle 14

## Approach

Add an authorization middleware (`requirePermission`) that checks the authenticated user's permissions via DB lookup (user_roles → role_permissions), returning 403 if the required permission is missing. Apply it to all RBAC routes. Create a seed endpoint (POST /seed) to bootstrap an admin role with all permissions, assignable to a specified user — only works when no admin role exists yet.

## Steps

1. Create a `requirePermission` middleware that takes a permission name, looks up the authenticated user's permissions via the DB (user_roles + role_permissions), and returns 403 if the permission is missing
2. Define the permission names needed (e.g., `manage_roles`, `manage_users`)
3. Create a seed endpoint (POST /seed) that creates an admin role with all permissions and assigns it to a specified user — only works when no admin role exists yet
4. Apply `requirePermission('manage_roles')` to POST /roles, GET /roles, POST /roles/:roleId/permissions
5. Apply `requirePermission('manage_users')` to GET /users, POST /users/:userId/roles, GET /users/:userId/permissions
6. Update existing tests to seed an admin user before calling RBAC endpoints
7. Add new tests that call RBAC endpoints without admin permissions and verify 403

## How to Test It

1. Run `pnpm test` from the monorepo root — verify all existing tests still pass (criterion 3)
2. Register a new user via POST /register with email/password
3. Login via POST /login to get a JWT token
4. Call POST /roles with that token — verify 403 response (user has no permissions) (criterion 1)
5. Call GET /roles with that token — verify 403 response (criterion 1)
6. Call GET /users with that token — verify 403 response (criterion 1)
7. Call POST /seed to create admin role and assign it to the test user (criterion 2)
8. Login again (or use same token if userId is in JWT) — call POST /roles with admin token — verify 200 success
9. Call GET /roles with admin token — verify 200 success
10. Call GET /users with admin token — verify 200 success
11. Review test output for new 403-specific test cases (criterion 4) — verify they exist and pass

## Risks and Unknowns

- Risk: Existing tests all assume any authenticated user can hit RBAC endpoints — many tests will break until updated with admin seeding
- Unknown: How the seed endpoint should be protected (open? one-time-use? require empty admin table?)
- Risk: Permission lookup on every request adds a DB query — could affect latency

## First Move

Create the `requirePermission` middleware that looks up user permissions via the DB and returns 403 if the required permission is missing — this is the core piece everything else depends on.
