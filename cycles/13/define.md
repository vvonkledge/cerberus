# Define — Cycle 13

## Problem Statement

RBAC endpoints (roles, permissions, user management) are unprotected — anyone can modify roles and permissions without authentication. Add auth middleware that requires a valid JWT to access these endpoints.

## Success Criteria

- [ ] All RBAC endpoints (POST /roles, GET /roles, POST /roles/:id/permissions, GET /users, POST /users/:id/roles, GET /users/:id/permissions) return 401 without a valid JWT
- [ ] Middleware extracts and validates JWT from Authorization: Bearer header
- [ ] All existing tests pass with zero regressions
- [ ] At least one new test verifies 401 on an unauthed RBAC request

## Out of Scope

- No role-based authorization (403) — only authentication (401). Any valid JWT grants access to RBAC endpoints
- No dashboard authentication — only API-level middleware
- No new CRUD operations (edit/delete for roles or assignments)
