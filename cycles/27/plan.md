# Plan — Cycle 27

## Approach

Add an ADMIN_SETUP_TOKEN env var to the Worker bindings, check it in the seed handler before proceeding, return 401 if missing or wrong, update existing tests to include the token.

## Steps

1. Add ADMIN_SETUP_TOKEN to the Hono app's Bindings type
2. Add a guard at the top of the POST /seed handler that reads the token from a request header and compares it to env.ADMIN_SETUP_TOKEN — return 401 if missing or wrong
3. Add ADMIN_SETUP_TOKEN to the test environment setup so existing seed tests pass
4. Write new tests: /seed without token returns 401, /seed with wrong token returns 401, /seed with correct token succeeds
5. Run full test suite and verify zero regressions

## How to Test It

1. Run `pnpm --filter api test` from the project root
2. Verify: All existing tests pass (no regressions) — confirms criterion 3
3. Verify: A new test exists that calls POST /seed with no Authorization header and receives 401 — confirms criterion 1
4. Verify: A new test exists that calls POST /seed with an incorrect token and receives 401 — confirms criterion 1
5. Verify: A new test exists that calls POST /seed with the correct ADMIN_SETUP_TOKEN and receives 200 (or 409 if already seeded) — confirms criterion 2
6. Run `pnpm --filter dashboard test` from the project root
7. Verify: All dashboard tests pass (no regressions) — confirms criterion 3

## Risks and Unknowns

- Risk: Existing E2E journey tests call POST /seed without a token and will break — mitigation: update test helpers to include ADMIN_SETUP_TOKEN
- Unknown: How the seed handler currently receives env bindings — need to check the Hono context pattern

## First Move

Read the seed handler in packages/api/src/rbac/seed.ts to understand how it accesses env bindings, then add the ADMIN_SETUP_TOKEN guard.
