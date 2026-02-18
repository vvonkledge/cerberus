# Define — Cycle 14

## Problem Statement

RBAC endpoints are authenticated but not authorized — any valid JWT grants full access to role and permission management. Add role-based authorization so only users with appropriate permissions can manage roles, permissions, and user-role assignments.

## Success Criteria

- [ ] RBAC endpoints return 403 when the authenticated user lacks the required permission (e.g., `manage_roles` for role endpoints, `manage_users` for user-role endpoints)
- [ ] A seed mechanism creates a default admin role with all permissions, assignable to the first registered user
- [ ] All existing tests pass with zero regressions
- [ ] New tests cover 403 scenarios for unauthorized access to each RBAC endpoint

## Out of Scope

- Dashboard authentication (separate cycle)
- Fine-grained per-resource permissions (e.g., "can edit role X but not role Y")
- UI for assigning the initial admin role
