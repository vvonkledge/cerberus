# Implementation Notes — Cycle 12

## Summary

Added sliding window rate limiting to auth endpoints (login, register, refresh) using a Hono middleware pattern with pluggable store backends. In-memory store for tests, Cloudflare KV store for production. 44 API tests pass (38 existing + 6 new), zero regressions.

## What Was Built

- Rate limiter middleware module with `RateLimitStore` interface, `InMemoryRateLimitStore` (Map-based with TTL), and `KVRateLimitStore` (Cloudflare Workers KV)
- `rateLimiter()` factory that returns Hono middleware accepting per-route config (limit, window, store)
- Rate limiting applied to POST /login (10 req/60s), POST /register (5 req/60s), POST /refresh (10 req/60s) via Hono sub-app pattern
- X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers on all rate-limited responses (both allowed and blocked)
- 6 new tests covering all rate limit scenarios

## Files Changed

### Created

- `packages/api/src/middleware/rate-limiter.ts` — Rate limiter middleware with store interface, in-memory store, KV store, and `rateLimiter()` factory function
- `packages/api/src/__tests__/rate-limit.test.ts` — 6 tests: login 429 at 11th request, register 429 at 6th, refresh 429 at 11th, health not rate-limited (25 requests all 200), 429 includes rate limit headers, successful responses include rate limit headers

### Modified

- `packages/api/src/index.ts` — Added `RATE_LIMIT_KV?: KVNamespace` to Bindings type. Imported rate limiter. Created sub-apps for login/register/refresh with rate limiting middleware applied per-route. Added `getStore()` helper that returns KV store if binding exists, otherwise falls back to in-memory store.
- `packages/api/wrangler.jsonc` — Added `kv_namespaces` binding for `RATE_LIMIT_KV` with placeholder ID

## Decisions Made

- **Sub-app pattern for per-route middleware:** Used Hono sub-apps (`loginApp`, `registerApp`, `refreshApp`) to apply rate limiting only to auth routes, rather than global middleware with path matching. This keeps non-auth routes completely free of rate limiting overhead.
- **Store interface for testability:** Abstracted storage behind `RateLimitStore` interface so tests use `InMemoryRateLimitStore` (fresh per test via `beforeEach`) while production uses `KVRateLimitStore`. No test contamination.
- **IP extraction fallback chain:** `CF-Connecting-IP` → `X-Forwarded-For` → `"unknown"`. CF-Connecting-IP is the canonical Cloudflare header. X-Forwarded-For as fallback for non-CF environments. Tests use X-Forwarded-For.
- **Fallback in-memory store in production:** If `RATE_LIMIT_KV` binding is not configured, index.ts falls back to an in-memory store. This prevents the app from crashing if KV isn't provisioned yet.
- **Placeholder KV ID in wrangler.jsonc:** Added `"id": "placeholder-id"` — the actual KV namespace must be created via `wrangler kv:namespace create` and the ID updated before deploying.

## Plan Deviations

Implementation followed the plan as written. The scope update (removing "no distributed rate limiting" from out-of-scope) was already noted in plan.md.

## Test Results

- Run `pnpm test`: **44 API tests passed, 1 dashboard test passed (45 total)**
- All 38 pre-existing API tests pass (zero regressions)
- rate-limit.test.ts: 6 tests pass:
  - POST /login returns 429 after exceeding 10 requests: PASS
  - POST /register returns 429 after exceeding 5 requests: PASS
  - POST /refresh returns 429 after exceeding 10 requests: PASS
  - GET /health is not rate-limited: PASS
  - 429 response includes rate limit headers: PASS
  - Successful responses include rate limit headers: PASS

## Challenges and Learnings

- **Hono sub-app middleware isolation:** The sub-app pattern (`loginApp.use("*", ...)` then `app.route("/login", loginApp)`) cleanly isolates middleware to specific route prefixes. This is the idiomatic Hono approach for per-route middleware.
- **Store instantiation timing:** In index.ts, the store is created per-request via `getStore(c.env)` because the KV binding is only available at request time via the context's `env`. A module-level `new KVRateLimitStore(kv)` wouldn't work since `env` isn't available at import time in Workers.
- **Fresh store per test:** Using `beforeEach` to create a fresh `InMemoryRateLimitStore` prevents rate limit counts from leaking between tests. Without this, the second test to use `/login` would already have a non-zero count.

## Notes for REFLECT

- Rate limiting now exists for auth endpoints. The placeholder KV ID in wrangler.jsonc needs to be replaced with an actual KV namespace before deployment.
- Test count grew from 38 to 44 API tests (6 new rate limit tests).
- The fallback in-memory store means rate limiting works even without KV, but resets on cold starts. This is acceptable per the plan.
- Non-auth endpoints remain completely unaffected.
