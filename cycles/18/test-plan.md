# Test Plan — Cycle 18

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Dev server running: `pnpm dev`
- A test user registered via: `curl -X POST http://localhost:8787/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"password123"}'`

## Test Steps

### Criterion 1: After login, both tokens are stored in localStorage

1. **Action:** Open http://localhost:5173/login in a browser
   **Verify:** Login page loads with email and password fields

2. **Action:** Enter email `test@test.com` and password `password123`, click Login
   **Verify:** Browser navigates to a protected page (e.g., /roles)

3. **Action:** Open browser devtools > Application > Local Storage > http://localhost:5173
   **Verify:** An entry for the access token exists and is a non-empty JWT string (starts with `eyJ`)

4. **Action:** Inspect localStorage entries
   **Verify:** An entry for the refresh token exists and is a non-empty string

### Criterion 2: A full page reload preserves the authenticated session

5. **Action:** With the authenticated session from step 2, press F5 (or Cmd+R) to do a full page reload
   **Verify:** The dashboard/protected page loads without redirecting to /login

6. **Action:** Observe page content after reload
   **Verify:** The page displays data fetched from authenticated API endpoints (e.g., roles list loads)

### Criterion 3: useApiFetch still intercepts 401s and refreshes correctly with persisted tokens

7. **Action:** Run existing test suite: `pnpm --filter dashboard test`
   **Verify:** All existing token-refresh tests pass (no regressions)

8. **Action:** Check new test output
   **Verify:** New test(s) confirm that after a 401 refresh, the updated tokens are written back to localStorage

### Criterion 4: Logout clears tokens from localStorage

9. **Action:** From the authenticated session, click the Logout button in the nav
   **Verify:** The browser redirects to /login

10. **Action:** Open browser devtools > Application > Local Storage > http://localhost:5173
    **Verify:** Access token and refresh token entries are removed from localStorage

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| After login, both tokens are stored in localStorage | Steps 1-4 |
| A full page reload preserves the authenticated session | Steps 5-6 |
| useApiFetch still intercepts 401s and refreshes correctly with persisted tokens | Steps 7-8 |
| Logout clears tokens from localStorage | Steps 9-10 |
