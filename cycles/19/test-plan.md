# Test Plan — Cycle 19

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Project dependencies installed (`pnpm install`)
- Local Turso dev database available (`turso dev`)
- Dev server startable with `pnpm dev`
- An admin user seeded via POST /seed

## Test Steps

1. **Action:** Run `pnpm --filter api test`
   **Verify:** All API tests pass including new DELETE and PUT endpoint tests

2. **Action:** Run `pnpm --filter dashboard test`
   **Verify:** All dashboard tests pass including new delete/edit interaction tests

3. **Action:** POST /seed to bootstrap admin user
   **Verify:** 200 response with admin role created

4. **Action:** POST /register then POST /login to get a JWT
   **Verify:** 200 response with access_token in body

5. **Action:** POST /roles with `{"name": "test-role"}` using the JWT
   **Verify:** 201 response with the created role object

6. **Action:** PUT /roles/:roleId with `{"name": "renamed-role"}` using the JWT
   **Verify:** 200 response with updated role showing name "renamed-role"

7. **Action:** DELETE /roles/:roleId using the JWT
   **Verify:** 200 response, then GET /roles confirms the role is no longer listed

8. **Action:** Create a role and assign it to a user via POST /users/:userId/roles
   **Verify:** 200 response confirming assignment

9. **Action:** DELETE /users/:userId/roles/:roleId using the JWT
   **Verify:** 200 response, then GET /users/:userId/permissions confirms the role is no longer assigned

10. **Action:** Call DELETE /roles/:roleId, DELETE /users/:userId/roles/:roleId, and PUT /roles/:roleId without an Authorization header
    **Verify:** All return 401

11. **Action:** Register a second user (no admin role), login, and call DELETE /roles/:roleId, DELETE /users/:userId/roles/:roleId, and PUT /roles/:roleId
    **Verify:** All return 403

12. **Action:** Start dev server with `pnpm dev`
    **Verify:** Server starts on expected port

13. **Action:** Log in as admin user in the dashboard
    **Verify:** Redirected to dashboard home

14. **Action:** Navigate to a role detail page
    **Verify:** Edit form (rename input) is visible on the page

15. **Action:** Enter a new name in the edit form and submit
    **Verify:** Role name updates on the page without errors

16. **Action:** Click delete button on role detail page
    **Verify:** Redirected to roles list, the deleted role is no longer shown

17. **Action:** Navigate to a user detail page with assigned roles
    **Verify:** Remove button is visible next to each assigned role

18. **Action:** Click remove button on an assigned role
    **Verify:** Role disappears from the assigned roles list without page reload

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| DELETE /roles/:roleId returns 200 and removes role | Steps 1, 7, 10, 11 |
| DELETE /users/:userId/roles/:roleId unassigns role | Steps 1, 9, 10, 11 |
| PUT /roles/:roleId returns updated role | Steps 1, 6, 10, 11 |
| Dashboard role detail has delete button | Steps 2, 16 |
| Dashboard user detail has remove button | Steps 2, 18 |
| Dashboard role detail has edit form | Steps 2, 14, 15 |
| All new API endpoints have passing tests | Step 1 |
| All new dashboard interactions have passing tests | Step 2 |
