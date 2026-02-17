# Define — Cycle 06

## Problem Statement

No auth exists yet. Add a user schema, registration, and login endpoints that issue OAuth 2.0-compatible tokens.

## Success Criteria

- [ ] POST /register creates a user with hashed password and returns 201
- [ ] POST /login with valid credentials returns an OAuth 2.0-compatible access token
- [ ] POST /login with invalid credentials returns 401
- [ ] User table exists with email, hashed password, and timestamps
- [ ] All new endpoints have passing tests

## Out of Scope

- Not implementing refresh tokens yet
- Not building the admin dashboard or role management
- Not handling password reset flows
- Not adding rate limiting or brute-force protection
- Not implementing OIDC discovery or .well-known endpoints
