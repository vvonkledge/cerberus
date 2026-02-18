# Define — Cycle 08

## Problem Statement

Add the roles and permissions data model so that users can be assigned roles and applications can check what a user is allowed to do. This is the foundation for all authorization logic in Cerberus.

## Success Criteria

- [ ] roles, permissions, role_permissions, and user_roles tables exist in the Drizzle schema
- [ ] POST /roles creates a role with a name and description, returns the created role
- [ ] POST /roles/:roleId/permissions assigns a permission to a role (permission is a string like "users:read")
- [ ] POST /users/:userId/roles assigns a role to a user and returns 200
- [ ] GET /users/:userId/permissions returns the user's resolved permissions — the merged set of permission strings from all assigned roles
- [ ] All existing 19 API tests still pass plus new tests for each endpoint above

## Out of Scope

- Not adding auth middleware to protect the role/permission endpoints (admin-only access comes later)
- Not implementing permission checks on existing endpoints (e.g. guarding /register or /login)
- Not building any admin dashboard UI for role management
- Not implementing hierarchical roles or role inheritance
- Not adding audit logging for role/permission changes
