# Implementation Notes — Cycle 27

## Summary
Gated the POST /seed endpoint behind an ADMIN_SETUP_TOKEN environment variable. The guard reads an `X-Setup-Token` header from the request and compares it to `env.ADMIN_SETUP_TOKEN`, returning 401 for missing, wrong, or unconfigured tokens. All 220 tests pass (154 API, 66 dashboard) with 4 new seed-auth tests and zero regressions.

## What Was Built
- **Setup token guard on POST /seed** — A 5-line guard at the top of the seed handler that reads `X-Setup-Token` from request headers and compares to `c.env.ADMIN_SETUP_TOKEN`. Returns `{ error: "Invalid setup token" }` with 401 if the token is missing, wrong, or the env var is unconfigured. Chosen approach is minimal and sits before any body parsing or DB access.
- **ADMIN_SETUP_TOKEN in Bindings type** — Added as optional (`ADMIN_SETUP_TOKEN?: string`) to both the local Bindings in seed.ts and the main app Bindings in index.ts, matching the pattern used by other optional env vars like TURSO_AUTH_TOKEN.
- **4 new seed-auth tests** — Dedicated test file covering: no header → 401, wrong header → 401, env var unconfigured → 401, correct token → 201 with admin role payload.
- **Updated all existing test files** that call /seed to include the token in both env and headers (8 calls in admin-setup-journey, 4 in audit-logs, 2 in api-keys, env update in error-paths).

## What Worked
- The existing test pattern of passing env as the third argument to `testApp.request()` made adding the token trivial — just add `ADMIN_SETUP_TOKEN` to the env object and `X-Setup-Token` to headers. The consistency of test patterns across the codebase made bulk updates mechanical.
- Using `replace_all` for repetitive header additions across test files saved significant time since the pattern `headers: { "Content-Type": "application/json" }` before seed call bodies was consistent.
- The guard implementation is minimal (5 lines) and sits at the very top of the handler, before any body parsing or DB access — this means unauthorized requests fail fast with zero wasted work.

## What Didn't Work
- First attempt at bulk-editing `audit-logs.test.ts` failed due to tab vs space indentation mismatch. The Read tool displays tabs as spaces, so the initial edit string didn't match the actual file content. Had to verify with `cat -A` to get exact whitespace. Lesson: always verify indentation format before bulk edits in test files.

## Files Changed

### Created
- `packages/api/src/__tests__/seed-auth.test.ts` — 4 tests for seed token authentication (no token, wrong token, unconfigured env, correct token)

### Modified
- `packages/api/src/rbac/seed.ts` — Added ADMIN_SETUP_TOKEN to local Bindings type + token guard at top of POST handler
- `packages/api/src/index.ts` — Added ADMIN_SETUP_TOKEN to main app Bindings type
- `packages/api/src/__tests__/admin-setup-journey.e2e.test.ts` — Added setup token to env + X-Setup-Token header to all 8 seed calls
- `packages/api/src/__tests__/audit-logs.test.ts` — Added setup token to env + X-Setup-Token header to all 4 seed calls
- `packages/api/src/__tests__/api-keys.test.ts` — Added setup token to env + X-Setup-Token header to both seed calls
- `packages/api/src/__tests__/error-paths.e2e.test.ts` — Added ADMIN_SETUP_TOKEN to env object

## Decisions Made
- **X-Setup-Token custom header vs Authorization: Bearer** — Chose X-Setup-Token because Authorization: Bearer is already used for JWT auth throughout the codebase. A custom header avoids confusion between "user authentication" and "setup token authentication" and prevents conflicts with the existing authMiddleware.
- **Guard behavior when ADMIN_SETUP_TOKEN is unset** — The guard also rejects requests when the env var is not configured (`!expectedToken`). This prevents a security hole where `undefined === undefined` would pass. If an operator deploys without setting the token, the seed endpoint is locked down rather than wide open.
- **Optional type (`?:`)** — Made ADMIN_SETUP_TOKEN optional in the Bindings type since Cloudflare Workers env vars are `undefined` when not set. Matches the pattern used by other optional env vars in the codebase.
- **Uniform error message** — Used "Invalid setup token" for all 401 cases (missing, wrong, unconfigured) to avoid leaking information about whether the env var is set.

## Plan Deviations
Implementation followed the plan as written.

## Test Results
- Step 1 (pnpm --filter api test): PASS — 154 tests across 16 files, zero failures
- Step 2 (seed-auth test cases): PASS — all 4 new tests verified: no token → 401, wrong token → 401, unconfigured env → 401, correct token → 201
- Step 3 (pnpm --filter dashboard test): PASS — 66 tests across 9 files, zero failures
- Step 4 (guard implementation review): PASS — guard reads X-Setup-Token, compares to env.ADMIN_SETUP_TOKEN, returns 401 on mismatch

## Challenges and Learnings

### Challenges
- Tab vs space indentation in test files caused a failed edit attempt. The Read tool displays both as spaces, hiding the distinction. Resolved by using `cat -A` to inspect actual whitespace before making bulk edits.

### Learnings
- When doing bulk edits across test files, verify the actual indentation format first (tabs vs spaces) before attempting replacements.
- The codebase's consistent test patterns (env as third arg, headers object) made adding a cross-cutting concern like a setup token to all test files straightforward — this consistency pays dividends when changes touch many test files.

## Product Insights
- The guard uses static string comparison with no timing-safe comparison. For a one-time setup token this is acceptable, but if this pattern is extended to other endpoints, a timing-safe comparison (`crypto.timingSafeEqual`) would be worth adding to prevent timing attacks.
- The ADMIN_SETUP_TOKEN must now be configured as a Cloudflare Workers secret alongside JWT_SECRET for staging and production deployments. This is a new operational requirement.

## Notes for REFLECT
- The /seed endpoint is now secured — the race condition described in the problem statement is eliminated. Only an operator with access to the ADMIN_SETUP_TOKEN secret can bootstrap admin access.
- New operational requirement: ADMIN_SETUP_TOKEN must be set as a Workers secret before any deployment where admin bootstrap is needed.
- The KV namespace placeholder in wrangler.jsonc (noted in Position) remains unresolved — unrelated to this cycle.
- Test count increased from 216 to 220 (4 new seed-auth tests).
- No architectural shifts. The change is localized and follows existing patterns.
- Recommendation for future: if more endpoints need setup-time-only authentication, consider extracting the token guard into reusable middleware rather than duplicating inline.
