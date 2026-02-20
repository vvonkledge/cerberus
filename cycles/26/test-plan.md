# Test Plan — Cycle 26

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Project dependencies installed (`pnpm install`)
- Dev server available (`pnpm dev` from project root)

## Test Steps

1. **Action:** Run `pnpm test` from the project root
   **Verify:** All existing 210 tests pass (zero regressions)

2. **Action:** Review new sidebar test output
   **Verify:** Sidebar component renders without crashing

3. **Action:** Review new sidebar test output
   **Verify:** Sidebar contains links with text: Roles, Users, Audit Logs, API Keys, Setup

4. **Action:** Review new sidebar test output
   **Verify:** Clicking a sidebar link changes the route to the correct path

5. **Action:** Review new sidebar test output
   **Verify:** The NavLink for the current route has an active/highlighted CSS class

6. **Action:** Review new sidebar test output
   **Verify:** Sidebar is rendered on a protected page (e.g. /roles) but NOT on /login

7. **Action:** Run `pnpm dev` and open http://localhost:5173 in a browser
   **Verify:** Dev server starts successfully

8. **Action:** Log in with valid credentials
   **Verify:** Redirected to a protected page

9. **Action:** Observe the page layout
   **Verify:** A sidebar is visible on the left side of every protected page

10. **Action:** Click each sidebar link one by one
    **Verify:** Each click navigates to the correct page

11. **Action:** After clicking a sidebar link, observe the sidebar
    **Verify:** The clicked link becomes visually highlighted and the previously active link is no longer highlighted

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| A sidebar is visible on all protected pages | Steps 6, 9 |
| Sidebar contains links to all 7 protected pages | Step 3 |
| Clicking a sidebar link navigates to the correct page | Steps 4, 10 |
| Current page is visually highlighted in the sidebar | Steps 5, 11 |
