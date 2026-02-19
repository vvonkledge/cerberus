# Define — Cycle 19

## Problem Statement

Add delete and edit operations for roles and role assignments so the dashboard supports full CRUD for RBAC management.

## Success Criteria

- [ ] DELETE /roles/:roleId returns 200 and removes the role from the database (requires manage_roles)
- [ ] DELETE /users/:userId/roles/:roleId unassigns the role from the user and returns 200 (requires manage_users)
- [ ] PUT /roles/:roleId with a new name returns the updated role (requires manage_roles)
- [ ] Dashboard role detail page has a delete button that removes the role and redirects to roles list
- [ ] Dashboard user detail page has a remove button next to each assigned role that unassigns it
- [ ] Dashboard role detail page has an edit form to rename the role
- [ ] All new API endpoints have passing tests
- [ ] All new dashboard interactions have passing tests

## Out of Scope

- Not adding cascade delete (deleting a role doesn't auto-unassign it from users)
- Not adding edit/delete for permissions themselves
