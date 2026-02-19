# Define — Cycle 17

## Problem Statement

The dashboard doesn't handle token expiration — when the JWT expires, API calls fail silently and the user must manually re-login.

## Success Criteria

- [ ] When a 401 response is received, useApiFetch automatically attempts a token refresh before failing
- [ ] If the refresh succeeds, the original request is retried transparently
- [ ] If the refresh fails (e.g., refresh token expired), the user is redirected to /login
- [ ] The access token and refresh token are both stored in AuthContext

## Out of Scope

- Not persisting tokens across browser sessions (localStorage/sessionStorage)
- Not adding a "session expired" toast or notification UI
- Not handling concurrent 401s (deduplicating refresh requests)
- Not adding refresh token cleanup for inactive users
