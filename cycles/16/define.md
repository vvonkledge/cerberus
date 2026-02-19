# Define — Cycle 16

## Problem Statement

The dashboard has no authentication — users can access all pages but API calls fail with 403. Add a login flow so dashboard users authenticate and the UI can make authorized API requests.

## Success Criteria

- [ ] User can log in on the dashboard with email and password
- [ ] Unauthenticated users are redirected to the login page
- [ ] API calls from the dashboard include the JWT in the Authorization header
- [ ] Dashboard displays a "logged out" state when no token is present

## Out of Scope

- Not implementing registration from the dashboard — login only
- Not adding token refresh logic in the dashboard — user re-logs if token expires
- Not adding role-based UI visibility (hiding pages based on permissions)
- Not persisting auth state across browser sessions (localStorage/cookies)
