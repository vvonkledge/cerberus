# Reflect — Cycle 13

## What Worked

- Reusing the existing sub-app middleware pattern from rate-limited routes kept the auth middleware integration consistent and simple.
- verifyJwt() was already a standalone function in crypto.ts — no extraction or refactoring needed.
- Updating existing tests to send JWTs in the same step as applying the middleware prevented any test breakage window.

## What Didn't Work

- The plan didn't account for list-endpoints.test.ts needing auth headers — lesson: when adding middleware to routes, audit ALL test files that touch those routes, not just the obvious ones.
- No other significant friction — the cycle was small and well-scoped.

## What Changed in Understanding

The `user` context variable set by the middleware is now available in all RBAC handlers, which sets up role-based authorization (403) as a natural next step. The middleware-to-route-handler context passing pattern in Hono is clean and composable.

## Product Changes

No product definition changes this cycle.
