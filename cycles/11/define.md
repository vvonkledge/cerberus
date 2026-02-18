# Define — Cycle 11

## Problem Statement

Revoked and expired refresh tokens accumulate in the database indefinitely. We need a cleanup mechanism to prune stale rows and prevent unbounded table growth.

## Success Criteria

- [ ] When POST /refresh issues a new token, all revoked and expired tokens for that user are deleted from the refresh_tokens table in the same operation
- [ ] After a rotation, the only refresh tokens remaining for that user are unexpired and non-revoked
- [ ] All existing tests pass with zero regressions (37+ tests)
- [ ] At least one new test verifies that stale tokens are pruned during rotation

## Out of Scope

- Not adding a scheduled/cron-based cleanup job
- Not adding an admin endpoint for manual bulk purge
- Not cleaning up tokens for users who are not currently refreshing
- Not adding token usage analytics or metrics
