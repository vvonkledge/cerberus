# Plan — Cycle 12

## Approach

Create a Hono middleware that implements sliding window rate limiting backed by Cloudflare Workers KV for production persistence and an in-memory Map for test isolation. The middleware accepts per-route config (limit, window), reads/increments counts keyed by IP + endpoint in the store, returns 429 with rate limit headers when exceeded, and attaches X-RateLimit-* headers to all responses. Apply it selectively to POST /login (10/60s), POST /register (5/60s), and POST /refresh (10/60s) only.

**Scope update from define.md:** The "not implementing distributed rate limiting" out-of-scope item is removed — we're using Cloudflare KV for persistence across isolates.

## Steps

1. Read the existing Hono app setup (index.ts / route mounting) to understand how middleware is applied to routes
2. Create a rate limiter middleware module that: accepts config (limit, window), reads the current count from a KV-like store keyed by IP + endpoint, increments the count, returns 429 with rate limit headers if exceeded, and sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on all responses
3. Create an in-memory store implementation (Map-based with TTL) for use in tests, and a KV store implementation for production using the Workers KV binding
4. Apply the middleware to POST /login (10 req/60s), POST /register (5 req/60s), and POST /refresh (10 req/60s) — do NOT apply to other routes
5. Run existing 38 tests to verify zero regressions
6. Write new tests: one that sends requests exceeding the limit and asserts 429 status + rate limit headers, and one that verifies a non-rate-limited endpoint is unaffected

## How to Test It

1. Run `pnpm test` from the monorepo root
2. **Verify:** All 38+ existing tests pass (zero regressions) — covers criterion 6
3. **Verify:** A new test exists that sends 11 POST /login requests in quick succession and asserts:
   a. The first 10 return 200 (or appropriate auth response)
   b. The 11th returns 429 with JSON body containing an error message
   c. The 429 response includes X-RateLimit-Limit, X-RateLimit-Remaining (0), and X-RateLimit-Reset headers
   — covers criteria 1, 4, and 7
4. **Verify:** A new test exists that sends 6 POST /register requests and asserts the 6th returns 429 — covers criterion 2
5. **Verify:** A new test exists that sends 11 POST /refresh requests and asserts the 11th returns 429 — covers criterion 3
6. **Verify:** A new test confirms GET /health is not rate-limited — send 20+ requests and assert none return 429 — covers criterion 5
7. **Verify:** All new tests pass as part of the `pnpm test` run

## Risks and Unknowns

- **Unknown:** Not sure how to extract the client IP in Hono on Cloudflare Workers — may need to check `c.req.header('CF-Connecting-IP')` or `c.req.header('X-Forwarded-For')`
- **Risk:** KV has eventual consistency (~60s propagation) — rate limits may not be perfectly enforced across globally distributed isolates within the propagation window. Mitigation: acceptable for auth abuse prevention, not a billing-grade limiter
- **Unknown:** Not sure if Workers KV binding is available in the test environment — may need the in-memory store for tests and KV for production
- **Risk:** Existing tests that make multiple requests to auth endpoints might accidentally trigger the rate limiter. Mitigation: use the in-memory store in tests and ensure per-test isolation (fresh store per test)

## First Move

Create the rate limiter middleware module with the store interface, in-memory implementation, and KV implementation before wiring it into routes.
