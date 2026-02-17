# Plan — Cycle 06

## Approach

Test-first, endpoint by endpoint. Write failing tests first for each endpoint, then implement to make them pass. The user schema emerges from what the endpoints need. Use Web Crypto API for password hashing and JWT signing (Cloudflare Workers compatible).

## Steps

1. Define user table schema with Drizzle (email, hashed_password, created_at, updated_at)
2. Write failing tests for POST /register (happy path + duplicate email)
3. Implement /register: validate input, hash password with Web Crypto, insert user, return 201
4. Write failing tests for POST /login (valid creds, invalid creds)
5. Implement /login: verify password, sign JWT access token, return token

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: Web Crypto API for password hashing (PBKDF2/scrypt) may behave differently between Cloudflare Workers and the test environment (in-memory SQLite + Vitest) — mitigation: abstract hashing behind an interface
- Unknown: Which JWT library works on Cloudflare Workers without Node.js polyfills?
- Risk: Drizzle schema push may need careful handling for the user table across environments
- Unknown: What should the OAuth 2.0 token response format look like exactly (access_token, token_type, expires_in)?

## First Move

Write a failing test for POST /register that expects a 201 response.
