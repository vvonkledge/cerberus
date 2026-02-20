# Plan — Cycle 24

## Approach

Build an ApiKeysPage component following the same patterns as the existing audit logs and roles pages — useApiFetch for API calls, React Router route, Vitest component tests with mocked fetch. The API endpoints already exist (POST/GET/DELETE /api-keys), so this is purely dashboard UI work.

## Steps

1. Create ApiKeysPage with empty shell and route
2. Add "API Keys" navigation link to the layout
3. Wire up GET /api-keys and render key list table (name, prefix, created date, revoked status)
4. Add create form with name input; on submit POST /api-keys
5. Add raw key display after creation — shown once with prominent warning, dismissed explicitly
6. Add revoke button per active key; on click DELETE /api-keys/:keyId and refresh list
7. Write tests for list rendering (table columns, data display)
8. Write tests for create flow (form submit, raw key display, dismissal)
9. Write tests for revoke flow (button click, API call, list refresh)
10. Write tests for edge states (empty, loading, error)

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: User might navigate away before copying raw key — mitigation: prominent warning text and keep key visible until explicit dismissal
- Unknown: Whether existing dashboard test mock patterns handle the create-then-display-once flow cleanly in tests

## First Move

Create the ApiKeysPage.tsx component file with a basic shell (heading, empty container), add the /api-keys route to React Router, and verify it renders.
