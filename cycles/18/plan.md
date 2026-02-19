# Plan — Cycle 18

## Approach

Create a small tokenStorage module that wraps localStorage get/set/clear for access and refresh tokens, then wire AuthContext to use it. This keeps storage logic separate from auth logic — AuthContext continues to manage React state, but tokenStorage provides the persistence layer underneath.

## Steps

1. Create a tokenStorage module with get, set, and clear functions wrapping localStorage
2. Update AuthContext to call tokenStorage.set on login (store both access and refresh tokens)
3. Update AuthContext to read from tokenStorage on mount and initialize state from persisted tokens
4. Update AuthContext logout to call tokenStorage.clear
5. Update useApiFetch's 401 refresh handler to persist the new tokens via tokenStorage after a successful refresh
6. Write tests: login persists tokens, reload restores session, logout clears tokens, 401 refresh updates persisted tokens

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: Existing tests mock React state for tokens — adding localStorage may require updating test setup with a localStorage mock
- Unknown: Not sure if AuthContext re-initializes from localStorage correctly on hot module reload during dev
- Risk: If tokenStorage and React state get out of sync, stale tokens could cause silent auth failures

## First Move

Create the tokenStorage module — a new file (e.g., token-storage.ts) with get, set, and clear functions wrapping localStorage for access and refresh tokens.
