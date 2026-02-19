# Test Plan — Cycle 21

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Repository cloned and dependencies installed (`pnpm install`)
- Tests run via `pnpm test` from the repo root

## Test Steps

1. **Action:** Run `pnpm test` from the repo root
   **Verify:** All existing 149 tests pass (no regressions)

2. **Action:** POST /forgot-password with a registered user's email
   **Verify:** 200 response containing a reset token string

3. **Action:** POST /forgot-password with a non-existent email
   **Verify:** 200 response (no user enumeration leak)

4. **Action:** POST /reset-password with the token from step 2 and a new password
   **Verify:** 200 response

5. **Action:** POST /login with the original password
   **Verify:** 401 response (old password no longer works)

6. **Action:** POST /login with the new password
   **Verify:** 200 response with access token (new password works)

7. **Action:** POST /reset-password with the same token from step 2 again
   **Verify:** 400 response (token already used)

8. **Action:** Generate a new reset token, manually set its expiresAt to the past in the test, then POST /reset-password with that token
   **Verify:** 400 response (expired token)

9. **Action:** POST /reset-password with a random/invalid token string
   **Verify:** 400 response

10. **Action:** GET /audit-logs filtered by event_type=password_reset_requested and event_type=password_reset_completed
    **Verify:** Entries exist with correct userId and relevant metadata

11. **Action:** Run `pnpm test` from the repo root
    **Verify:** All tests pass including new password reset tests

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| POST /forgot-password returns 200 for valid email and generates a reset token | Steps 2, 3 |
| POST /reset-password with a valid token and new password changes the user's password | Step 4 |
| Reset tokens expire after a configured duration | Step 8 |
| User can log in with the new password after reset | Steps 5, 6 |
| Used reset tokens cannot be reused | Step 7 |
| Audit log entries written for password reset events | Step 10 |
