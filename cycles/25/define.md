# Define — Cycle 25

## Problem Statement

The only way to bootstrap an admin user is via curl to POST /seed. Add a dashboard UI so the first user can self-bootstrap without leaving the browser.

## Success Criteria

- [ ] Navigating to /setup shows a setup page when no admin role exists
- [ ] Clicking "Bootstrap Admin" on /setup calls POST /seed with the current user's ID
- [ ] After successful seed, /setup redirects to the dashboard home
- [ ] If admin role already exists, /setup shows a message and no bootstrap button

## Out of Scope

- Not adding a multi-step onboarding wizard — just the single seed action
- Not changing the POST /seed API endpoint behavior
- Not adding auto-redirect from login to /setup for new installs
- Not handling the case where the user is not yet logged in on /setup
