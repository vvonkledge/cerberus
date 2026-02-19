# Define — Cycle 18

## Problem Statement

Tokens are stored only in React state, so a page reload or new browser tab loses the authenticated session. We need to persist both the access token and refresh token in localStorage so auth survives across browser sessions.

## Success Criteria

- [ ] After login, both tokens are stored in localStorage
- [ ] A full page reload preserves the authenticated session
- [ ] useApiFetch still intercepts 401s and refreshes correctly with persisted tokens
- [ ] Logout clears tokens from localStorage

## Out of Scope

- No "remember me" toggle or session duration controls
- No encryption of tokens in localStorage
- No deduplication of concurrent 401 refreshes
- No XSS hardening beyond what the framework provides
