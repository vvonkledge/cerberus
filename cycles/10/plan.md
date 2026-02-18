# Plan — Cycle 10

## Approach

Revoke-and-reissue: In the /refresh handler, validate the old refresh token, revoke it (set revoked=true), generate and insert a new refresh token, and return both the new access token and new refresh token in the response.

## Steps

1. Read the current /refresh handler and refresh token utility code to understand the existing flow
2. Modify the refresh handler to generate a new refresh token after validating the old one
3. Insert the new refresh token into the database and revoke the old one in the same operation
4. Update the /refresh response to return both the new access token and new refresh token
5. Write tests: successful rotation returns new refresh token, old token is rejected, rotated token reuse returns 401

## How to Test It

1. Run `pnpm test` from the monorepo root to execute the full test suite
2. Verify all existing tests still pass (zero regressions)
3. Verify a new test exists that: calls POST /login, uses the returned refresh token to call POST /refresh, and confirms the response contains both `access_token` and `refresh_token` fields (covers criterion 1)
4. Verify a new test exists that: performs a refresh, then attempts POST /refresh with the OLD refresh token, and confirms a 401 response (covers criterion 2)
5. Verify a new test exists that: performs two sequential refreshes (A→B→C), then attempts to reuse token B, and confirms a 401 response (covers criterion 3)

## Risks and Unknowns

- Risk: Race condition if two refresh requests fire simultaneously with the same token — mitigation: the first one wins, second gets 401
- Unknown: Not sure if revoking + inserting should be wrapped in a transaction for atomicity
- Risk: Existing tests may assume /refresh returns only an access token — they'll need updating

## First Move

Read the /refresh route handler and the refresh token utility functions to understand the current flow before modifying anything.
