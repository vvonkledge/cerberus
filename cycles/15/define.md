# Define — Cycle 15

## Problem Statement

Add end-to-end tests that validate all user-facing API workflows (registration, login, token management, RBAC operations) to ensure the system works correctly as an integrated whole.

## Success Criteria

- [ ] E2E tests cover full workflows: register, login, refresh, revoke, seed, role creation, permission assignment, user-role assignment, and permission resolution
- [ ] Tests cover both happy paths and error paths (invalid credentials, expired tokens, unauthorized access, duplicate registration)
- [ ] All existing 58 API tests continue to pass with zero regressions

## Out of Scope

- Not adding any new API endpoints or features — only writing tests for what exists
- Not testing the React dashboard UI — only API-level E2E tests
- Not doing load testing, performance benchmarks, or stress testing
