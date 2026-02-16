# Test Plan — Cycle 05

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- A GitHub repository with push access
- Turso CLI installed locally (`turso db list` works)
- Access to the GitHub Actions logs

## Test Steps

1. **Action:** Create a test branch, push a trivial change, and open a PR
   **Verify:** PR is created and the preview deploy workflow triggers

2. **Action:** Wait for the preview deploy workflow to complete
   **Verify:** Workflow completes successfully (green check)

3. **Action:** Check the GitHub Actions log for the `turso db create cerberus-pr-<N>` step
   **Verify:** Log shows the database was created successfully

4. **Action:** Run `turso db list` locally
   **Verify:** `cerberus-pr-<N>` appears in the list

5. **Action:** Check the Actions log for the `turso db tokens create` step
   **Verify:** Log shows a token was generated

6. **Action:** Check the Actions log for the `wrangler secret put` steps
   **Verify:** Log shows TURSO_DATABASE_URL and TURSO_AUTH_TOKEN were set

7. **Action:** Hit the preview worker's /health endpoint
   **Verify:** Returns OK with DB connectivity confirmed

8. **Action:** Check the Actions log for `drizzle-kit push`
   **Verify:** Schema was pushed to the per-PR database

9. **Action:** Close the PR
   **Verify:** The cleanup workflow triggers

10. **Action:** Wait for the cleanup workflow to complete
    **Verify:** Workflow completes successfully (green check)

11. **Action:** Check the Actions log for `turso db destroy`
    **Verify:** Log shows the database was destroyed

12. **Action:** Run `turso db list` locally
    **Verify:** `cerberus-pr-<N>` is no longer in the list

13. **Action:** Attempt to access the preview worker URL
    **Verify:** Returns 404 or is no longer accessible

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| PR deploy creates a database named cerberus-pr-<number> | Steps 3, 4 |
| Worker receives DB URL and auth token as secrets | Steps 5, 6, 7 |
| Schema is pushed to the per-PR database before deploy | Step 8 |
| Closing a PR destroys the database and preview worker | Steps 9, 10, 11, 12, 13 |
