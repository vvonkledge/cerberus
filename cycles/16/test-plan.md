# Test Plan — Cycle 16

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Dev server running via `pnpm dev`
- A test user registered via curl (see step 5)

## Test Steps

1. **Action:** Run `pnpm dev` to start the dev server
   **Verify:** Server starts without errors

2. **Action:** Open http://localhost:5173 in a browser
   **Verify:** You are redirected to /login (not the dashboard home page)

3. **Action:** Inspect the login page
   **Verify:** The login page shows email and password input fields and a Login button

4. **Action:** Enter an invalid email/password and click Login
   **Verify:** An error message is displayed (e.g. "Invalid credentials")

5. **Action:** Register a test user via curl: `curl -X POST http://localhost:8787/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123"}'`
   **Verify:** User is created successfully (200 response)

6. **Action:** Enter email "test@test.com" and password "password123" on the login page and click Login
   **Verify:** You are redirected to the dashboard home page (e.g. /roles or /)

7. **Action:** Inspect the navigation bar
   **Verify:** The navigation shows a logout button

8. **Action:** Navigate to the Roles page
   **Verify:** The page loads data from the API without 403 errors (check Network tab or page content)

9. **Action:** Click the logout button
   **Verify:** You are redirected back to /login

10. **Action:** Navigate directly to /roles in the browser URL bar
    **Verify:** You are redirected back to /login

11. **Action:** Run `pnpm test`
    **Verify:** All existing tests still pass plus new tests pass

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| User can log in on the dashboard with email and password | Step 6 |
| Unauthenticated users are redirected to the login page | Steps 2, 10 |
| API calls from the dashboard include the JWT in the Authorization header | Step 8 |
| Dashboard displays a "logged out" state when no token is present | Steps 2-3, 9 |
