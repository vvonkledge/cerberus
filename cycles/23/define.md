# Define — Cycle 23

## Problem Statement

Add API key management so applications can authenticate with Cerberus programmatically for service-to-service communication, fulfilling a core product feature not yet implemented.

## Success Criteria

- [ ] POST /api-keys creates an API key and returns the raw key exactly once
- [ ] GET /api-keys lists all keys for the authenticated user (key values are masked)
- [ ] DELETE /api-keys/:keyId revokes a key and it can no longer authenticate
- [ ] A request with a valid API key in the Authorization header is authenticated
- [ ] API key creation and revocation are recorded in audit logs

## Out of Scope

- Not adding API key scopes or per-key permission restrictions
- Not adding API key expiration or rotation
- Not building dashboard UI for API key management
- Not adding rate limiting specific to API keys
