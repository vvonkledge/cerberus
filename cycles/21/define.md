# Define — Cycle 21

## Problem Statement

Implement password reset so users can recover accounts when they forget their password — this is a core product feature (listed in product.md) that doesn't exist yet.

## Success Criteria

- [ ] POST /forgot-password returns 200 for valid email and generates a reset token
- [ ] POST /reset-password with a valid token and new password changes the user's password
- [ ] Reset tokens expire after a configured duration
- [ ] User can log in with the new password after reset
- [ ] Used reset tokens cannot be reused
- [ ] Audit log entries written for password reset events

## Out of Scope

- No email delivery — reset token returned in API response for now
- No dashboard UI for password reset — API only this cycle
- No account lockout after failed reset attempts
- No rate limiting on reset endpoints this cycle
