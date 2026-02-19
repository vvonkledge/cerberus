# Plan — Cycle 19

## Approach

Build in vertical slices: complete each feature end-to-end (API endpoint → API tests → dashboard UI → dashboard tests) before moving to the next. Slice order: delete role, delete role assignment, edit/rename role.

## Steps

1. Add DELETE /roles/:roleId endpoint with manage_roles authorization
2. Write API tests for DELETE /roles/:roleId (success, 401, 403, 404)
3. Add delete button to dashboard role detail page that calls the endpoint and redirects to roles list
4. Write dashboard tests for role delete interaction
5. Add DELETE /users/:userId/roles/:roleId endpoint with manage_users authorization
6. Write API tests for DELETE /users/:userId/roles/:roleId (success, 401, 403, 404)
7. Add remove button next to each assigned role on dashboard user detail page
8. Write dashboard tests for role unassignment interaction
9. Add PUT /roles/:roleId endpoint with manage_roles authorization
10. Write API tests for PUT /roles/:roleId (success, 401, 403, 404, validation)
11. Add edit/rename form to dashboard role detail page
12. Write dashboard tests for role rename interaction

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: DELETE /roles/:roleId on a role still assigned to users — should it return 409 Conflict or silently succeed? (cascade delete is out of scope, so need a clear decision)
- Unknown: Not sure if the existing role detail page component structure will easily accommodate an edit form alongside the current content

## First Move

Add the DELETE /roles/:roleId route handler in the Hono roles router file.
