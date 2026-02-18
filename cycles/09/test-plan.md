# Test Plan — Cycle 09

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Run `pnpm dev` to start the dev server
- Register a test user: `curl -X POST http://localhost:8787/register -H 'Content-Type: application/json' -d '{"email":"admin@test.com","password":"test1234"}'`

## Test Steps

1. **Action:** Navigate to `http://localhost:5173/roles`
   **Verify:** The roles page loads and shows a list (empty or with existing roles)

2. **Action:** Fill in role name `editor` and description `Can edit content` in the create role form. Click Create.
   **Verify:** The role `editor` appears in the roles list

3. **Action:** Click on the `editor` role to see its detail view
   **Verify:** The role detail view loads showing the role name and an empty permissions list

4. **Action:** Enter permission string `posts:write` in the assign permission form. Click Assign.
   **Verify:** `posts:write` appears in the role's permissions list

5. **Action:** Navigate to the users page (e.g., `http://localhost:5173/users`)
   **Verify:** The users page loads and shows `admin@test.com` in the list

6. **Action:** Click on `admin@test.com` user. In the assign role form, select the `editor` role. Click Assign.
   **Verify:** `editor` appears in the user's assigned roles

7. **Action:** View the user's resolved permissions section on the user detail view
   **Verify:** `posts:write` appears in the resolved permissions list

8. **Action:** Create a second role `viewer` with description `Read-only access`, assign permission `posts:read` to it, assign it to the same user
   **Verify:** User's resolved permissions now show both `posts:write` and `posts:read`

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| Dashboard has a roles page that lists all existing roles | Step 1 |
| Admin can create a new role from the dashboard | Step 2 |
| Admin can assign permission strings to a role from the dashboard | Step 3, Step 4 |
| Admin can assign roles to a user from the dashboard | Step 5, Step 6 |
| Admin can view a user's resolved permissions from the dashboard | Step 7, Step 8 |
