# Define — Cycle 24

## Problem Statement

The API key management endpoints exist but can only be used via curl or API clients. Add a dashboard page for API key management so users can create, view, and revoke their API keys from the browser.

## Success Criteria

- [ ] Dashboard has an /api-keys page listing keys with name, prefix, created date, and revoked status
- [ ] User can create a new API key via a form and sees the raw key exactly once
- [ ] User can revoke an API key from the dashboard
- [ ] Navigation includes an "API Keys" link
- [ ] Tests cover create, list, and revoke operations plus key states (active, revoked)

## Out of Scope

- Not adding API key scopes or per-key permissions
- Not adding key expiration or rotation
- Not paginating the key list
- Not adding search or filter on the key list
