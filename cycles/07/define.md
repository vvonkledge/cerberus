# Define — Cycle 07

## Problem Statement

Add refresh tokens so users get new access tokens without re-entering credentials, enabling persistent sessions beyond the current 1-hour access token expiry.

## Success Criteria

- [ ] POST /refresh with a valid refresh token returns a new access token
- [ ] Refresh tokens expire after 7 days
- [ ] Using a revoked refresh token returns 401
- [ ] All existing tests still pass plus new refresh token tests

## Out of Scope

- Not implementing token rotation (issuing new refresh token on each refresh)
- Not adding rate limiting on the refresh endpoint
- Not building any UI for token management
- Not implementing logout/revoke-all-sessions endpoint
