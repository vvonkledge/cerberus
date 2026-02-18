# Define — Cycle 12

## Problem Statement

Auth endpoints (login, register, refresh) have no rate limiting, leaving them vulnerable to brute-force and credential-stuffing attacks. We need to add request throttling to prevent abuse.

## Success Criteria

- [ ] POST /login returns 429 Too Many Requests after exceeding 10 requests per 60-second sliding window from the same IP
- [ ] POST /register returns 429 Too Many Requests after exceeding 5 requests per 60-second sliding window from the same IP
- [ ] POST /refresh returns 429 Too Many Requests after exceeding 10 requests per 60-second sliding window from the same IP
- [ ] All rate-limited responses include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers
- [ ] Non-auth endpoints (GET /health, GET /roles, GET /users) are not rate-limited
- [ ] All existing tests pass with zero regressions (38+ tests)
- [ ] At least one new test verifies that a rate-limited endpoint returns 429 after exceeding the threshold

## Out of Scope

- Not implementing distributed rate limiting across multiple Workers instances (in-memory per-isolate is fine for now)
- Not adding user-level rate limiting (only IP-based)
- Not adding rate limiting to RBAC management endpoints
- Not adding a rate limit dashboard or monitoring
