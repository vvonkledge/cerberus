# Test Plan — Cycle 03

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- GitHub repository with Actions enabled
- Cloudflare API token configured as GitHub Actions secret
- All workflow files committed and pushed

## Test Steps

### Criterion 1: PR triggers lint + tests

1. **Action:** Create a branch (`git checkout -b test/ci-check`) and push a commit
   **Verify:** Push succeeds

2. **Action:** Open a PR against main
   **Verify:** PR is created successfully

3. **Action:** Go to the PR's "Checks" tab on GitHub
   **Verify:** GitHub Actions shows a running workflow for `pr-checks`

4. **Action:** Wait for the workflow to complete
   **Verify:** Workflow completes with lint and test jobs both passing (green checkmarks)

### Criterion 2: PR triggers preview deploy

5. **Action:** On the same PR, go to the "Checks" tab
   **Verify:** A second workflow (`preview-deploy`) triggered

6. **Action:** Open the workflow run details
   **Verify:** Workflow output contains a unique Cloudflare Workers preview URL

7. **Action:** Open the preview URL in a browser
   **Verify:** The page loads without errors

8. **Action:** Navigate to `/health` on the preview URL
   **Verify:** The Hono health endpoint responds with 200 OK

9. **Action:** Navigate to the root URL `/`
   **Verify:** The React app loads and renders content

### Criterion 3: Merge to main deploys staging

10. **Action:** Merge the PR to main
    **Verify:** PR merge completes successfully

11. **Action:** Go to the repo's Actions tab on GitHub
    **Verify:** `staging-deploy` workflow triggers automatically

12. **Action:** Wait for the workflow to complete
    **Verify:** Workflow completes successfully (green checkmark)

13. **Action:** Open the staging URL in a browser
    **Verify:** The page loads without errors

14. **Action:** Navigate to `/health` on the staging URL
    **Verify:** Health endpoint responds with 200 OK and React app loads at root

### Criterion 4: Tag deploys production

15. **Action:** Create and push a git tag (`git tag v0.1.0 && git push origin v0.1.0`)
    **Verify:** Tag push succeeds

16. **Action:** Go to the repo's Actions tab on GitHub
    **Verify:** `production-deploy` workflow triggers automatically

17. **Action:** Wait for the workflow to complete
    **Verify:** Workflow completes successfully (green checkmark)

18. **Action:** Open the production URL in a browser
    **Verify:** The page loads without errors

19. **Action:** Navigate to `/health` on the production URL
    **Verify:** Health endpoint responds with 200 OK and React app loads at root

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| PR triggers a GitHub Actions workflow that runs lint and tests | Steps 1-4 |
| PR triggers a preview deployment to Cloudflare Workers with a unique URL (Hono + React deployed as one) | Steps 5-9 |
| Merge to main auto-deploys to a staging environment on Cloudflare | Steps 10-14 |
| Creating a git tag triggers production deployment on Cloudflare | Steps 15-19 |
