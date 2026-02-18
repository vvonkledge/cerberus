# Define — Cycle 10

## Problem Statement

Implement refresh token rotation so each refresh issues a new refresh token and invalidates the old one.

## Success Criteria

- [ ] POST /refresh returns a new refresh token alongside the new access token
- [ ] The old refresh token is invalidated after a successful refresh
- [ ] Using an already-rotated refresh token returns a 401 error

## Out of Scope

- Not adding token family tracking / reuse detection across chains
- Not adding rate limiting on the refresh endpoint
- Not protecting RBAC endpoints with auth middleware yet
- Not adding dashboard authentication
