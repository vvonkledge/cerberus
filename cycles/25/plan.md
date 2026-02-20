# Plan — Cycle 25

## Approach

Check-then-render pattern. Create a SetupPage component that on mount checks whether an admin role already exists. If no admin role, show a "Bootstrap Admin" button. If admin role exists, show an "already configured" message. The button calls POST /seed with the current user's ID from AuthContext, then redirects to /.

## Steps

1. Add /setup route to React Router config pointing to a new SetupPage component
2. Create SetupPage component that calls GET /roles on mount via useApiFetch
3. In SetupPage, check if a role named 'admin' exists in the response
4. If no admin role: render a heading, explanation text, and "Bootstrap Admin" button
5. If admin role exists: render an "Already configured" message with no button
6. On button click, call POST /seed with { userId } from AuthContext, then navigate to / on success
7. Handle error states (network failure, unexpected 409 race condition) with an error message
8. Add SetupPage link to navigation or keep it as a manual /setup URL
9. Write tests for SetupPage: no-admin render, already-configured render, seed call, redirect, error state

## How to Test It

**Automated tests (Vitest):**

1. **Action:** Run `pnpm test` from the monorepo root
   **Verify:** All existing 200 tests still pass (zero regressions)
2. **Action:** Run `pnpm test` from the monorepo root
   **Verify:** New SetupPage tests pass
3. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — SetupPage renders loading state while fetching
4. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — SetupPage renders "Bootstrap Admin" button and explanation text when no admin role exists
5. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — SetupPage renders "Already configured" message with no button when admin role exists
6. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — Clicking "Bootstrap Admin" calls POST /seed with the current user's ID from AuthContext
7. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — After successful POST /seed, the page navigates to /
8. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — When POST /seed returns 409 (race condition), an appropriate message is shown
9. **Action:** Check test output for SetupPage test file
   **Verify:** Test exists — When POST /seed or the admin-check request fails with a network error, an error message is shown

**Success Criteria Coverage:**

| Success Criterion | Verified by Test(s) |
|---|---|
| Navigating to /setup shows a setup page when no admin role exists | Test 4 |
| Clicking "Bootstrap Admin" calls POST /seed with current user's ID | Test 6 |
| After successful seed, /setup redirects to dashboard home | Test 7 |
| If admin role already exists, shows message and no bootstrap button | Test 5 |

## Risks and Unknowns

- Risk: GET /roles requires manage_roles permission — a fresh user won't have it yet, so the admin-exists check might 403. Mitigation: need to find another way to detect if admin role exists, or POST /seed's 409 response could serve as the check.
- Unknown: How POST /seed identifies the current user — does it accept userId in the body, or does it need to be extracted from the JWT?
- Risk: Race condition if two users hit /setup simultaneously — POST /seed returns 409 for the second one, which the error handler should handle gracefully.

## First Move

Create the SetupPage.tsx file with the basic component skeleton and route registration.
