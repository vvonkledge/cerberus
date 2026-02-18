# Plan — Cycle 08

## Approach

Build incrementally: add all 4 tables to the Drizzle schema first, then implement and test each endpoint one at a time. Each endpoint gets its own route file and corresponding tests before moving to the next. Register all routes in index.ts along the way. Run the full suite at the end to confirm zero regressions.

## Steps

1. Add roles, permissions, role_permissions, and user_roles tables to the Drizzle schema
2. Implement POST /roles (create a role with name and description) and write tests for it
3. Implement POST /roles/:roleId/permissions (assign a permission string to a role) and write tests
4. Implement POST /users/:userId/roles (assign a role to a user) and write tests
5. Implement GET /users/:userId/permissions (resolve all permissions from assigned roles) and write tests
6. Register all new routes in index.ts
7. Run the full test suite to verify zero regressions on existing 19 tests

## How to Test It

1. Run `pnpm test` from the monorepo root
2. Verify all 19 existing API tests still pass (no regressions)
3. Verify new test: POST /roles with `{"name": "admin", "description": "Administrator"}` returns 201 with the created role including an id
4. Verify new test: POST /roles with a duplicate name returns an error (409 or 400)
5. Verify new test: POST /roles/:roleId/permissions with `{"permission": "users:read"}` returns 200
6. Verify new test: POST /roles/:roleId/permissions with a non-existent roleId returns 404
7. Verify new test: POST /users/:userId/roles with `{"roleId": "<valid-role-id>"}` returns 200
8. Verify new test: POST /users/:userId/roles with a non-existent userId returns 404
9. Verify new test: GET /users/:userId/permissions returns 200 with `{"permissions": ["users:read"]}` after assigning the role with that permission
10. Verify new test: GET /users/:userId/permissions returns `{"permissions": []}` for a user with no roles
11. Verify the total test count increased (19 existing + new RBAC tests all pass)

## Risks and Unknowns

- Risk: The many-to-many join tables (role_permissions, user_roles) may not work cleanly with the in-memory SQLite test database used in tests
- Unknown: Whether Drizzle ORM handles multi-table joins (roles → role_permissions → permissions) efficiently for the permission resolution query
- Risk: Adding 4 new tables may make the test setup boilerplate heavy — each test file needs to create all tables

## First Move

Add the roles, permissions, role_permissions, and user_roles tables to the Drizzle schema file (`packages/api/src/db/schema.ts`).
