# Test Plan — Cycle 24

> Step-by-step verification runbook for success criteria defined in define.md.

## Prerequisites

- Monorepo dependencies installed (`pnpm install`)
- All 189 existing tests passing

## Test Steps

1. **Action:** Run `pnpm test` from monorepo root
   **Verify:** All existing 189 tests pass (zero regressions)

2. **Action:** Check for new test file for ApiKeysPage component
   **Verify:** Test file exists in the dashboard test directory

3. **Action:** Inspect list rendering tests
   **Verify:** Tests confirm table renders columns: name, prefix, created date, revoked status

4. **Action:** Inspect create flow tests
   **Verify:** Tests confirm submitting form calls POST /api-keys and displays the raw key returned

5. **Action:** Inspect raw key dismissal tests
   **Verify:** Tests confirm raw key display disappears after explicit dismissal and is not shown on re-render

6. **Action:** Inspect revoke flow tests
   **Verify:** Tests confirm revoke button calls DELETE /api-keys/:keyId and the list refreshes

7. **Action:** Inspect empty state test
   **Verify:** Test confirms appropriate message when no keys exist

8. **Action:** Inspect loading state test
   **Verify:** Test confirms loading indicator while fetching keys

9. **Action:** Inspect error state test
   **Verify:** Test confirms error message on fetch failure

10. **Action:** Inspect navigation link
    **Verify:** "API Keys" link exists in the navigation layout component

11. **Action:** Inspect route configuration
    **Verify:** /api-keys route is registered and renders ApiKeysPage component

12. **Action:** Run `pnpm test` from monorepo root
    **Verify:** Total test count increased beyond 189 and all tests pass

## Success Criteria Coverage

| Success Criterion | Verified by Step(s) |
|---|---|
| Dashboard has /api-keys page listing keys with name, prefix, created date, revoked status | Steps 3, 11 |
| User can create a new API key via a form and sees the raw key exactly once | Steps 4, 5 |
| User can revoke an API key from the dashboard | Step 6 |
| Navigation includes an "API Keys" link | Step 10 |
| Tests cover create, list, and revoke operations plus key states | Steps 1-12 collectively |
