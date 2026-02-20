# Define — Cycle 27

## Problem Statement

The /seed endpoint has no authentication, allowing anyone to bootstrap admin access in a race condition. We need to gate it behind a setup secret.

## Success Criteria

- [ ] POST /seed returns 401 when no ADMIN_SETUP_TOKEN is provided
- [ ] POST /seed succeeds when the correct token is provided in the request
- [ ] Existing tests still pass with the new guard in place

## Out of Scope

- Not adding token rotation or expiration to the setup secret
- Not updating the dashboard /setup page to prompt for the token
- Not adding rate limiting to /seed
