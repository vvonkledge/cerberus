# Reflect — Cycle 12

## What Worked

- Hono sub-app pattern (`loginApp.use("*", ...)` then `app.route("/login", loginApp)`) cleanly isolated rate limiting middleware to specific auth routes, keeping non-auth routes completely free of overhead
- Store interface abstraction (`RateLimitStore`) enabled clean test isolation with `InMemoryRateLimitStore` (fresh per test via `beforeEach`) while production uses `KVRateLimitStore` — no test contamination
- IP extraction fallback chain (`CF-Connecting-IP` → `X-Forwarded-For` → `"unknown"`) handled both Cloudflare production and test environments without issues
- Fallback in-memory store in production prevents crashes if KV binding is not provisioned — graceful degradation without configuration dependency
- Implementation followed the plan exactly with no deviations; all 7 success criteria met with 44 API tests passing (6 new, 38 existing with zero regressions)

## What Didn't Work

No significant blockers encountered. Implementation proceeded as planned.

## What Changed in Understanding

Learned that Hono sub-apps are the idiomatic approach for per-route middleware isolation, and that Workers KV bindings are only available at request time via the context's `env` — meaning store instantiation must happen per-request, not at module level. No significant shift in problem or architecture understanding; the planned approach worked as designed.

## Product Changes

No product definition changes this cycle.
