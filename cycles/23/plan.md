# Plan — Cycle 23

## Approach

Generate prefixed API keys (crb_<random hex>), store a SHA-256 hash in a new api_keys table, and extend the existing auth middleware to accept both JWT Bearer tokens and API key Bearer tokens. The middleware detects the key format by prefix — tokens starting with `crb_` are hashed and looked up in the api_keys table; all others follow the existing JWT path.

## Steps

1. Add api_keys table to Drizzle schema (id, userId, name, keyHash, keyPrefix, createdAt, revokedAt)
2. Implement POST /api-keys — generate prefixed key (crb_<random hex>), hash with SHA-256, store hash + prefix + metadata, return raw key in response
3. Implement GET /api-keys — list user's keys showing name, prefix, createdAt, revokedAt (never the hash)
4. Implement DELETE /api-keys/:keyId — set revokedAt timestamp (soft delete)
5. Extend auth middleware to accept API keys — hash incoming Bearer token, look up by hash, reject if revoked, attach userId to context
6. Add audit log entries for api_key_created and api_key_revoked events
7. Write tests for all endpoints and API key authentication

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: Auth middleware currently assumes JWT format — extending it to also handle API keys might break existing JWT auth if not careful. Mitigation: detect key format by prefix before choosing auth path.
- Unknown: Whether Hono's middleware chaining allows cleanly falling through from API key check to JWT check, or if we need a unified auth handler.
- Risk: Storing key hash means if the hashing approach changes, old keys become invalid. Mitigation: out of scope for now, note it for future.

## First Move

Add the api_keys table definition to the Drizzle schema file and verify it works with drizzle-kit push.
