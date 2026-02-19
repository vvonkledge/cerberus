# Reflect — Cycle 23

## What Worked

- **Prefix-based auth routing**: Detecting `crb_` prefix in the Bearer token cleanly separates API key auth from JWT auth without ambiguity. This avoids needing a separate header (like X-API-Key) and keeps the auth interface uniform — any client that can send Bearer tokens can use API keys without code changes.
- **Following existing patterns**: The apiKeys table, route handlers, and audit logging all followed the exact patterns established in earlier cycles (roles.ts, password-reset-tokens, writeAuditLog). This made implementation fast, consistent, and friction-free.
- **SHA-256 for key hashing**: Using SHA-256 via Web Crypto API is fast, deterministic, and sufficient for high-entropy API keys (256 bits from 32 random bytes), unlike passwords which need slow hashing like PBKDF2. Auth lookups stay fast.
- **Soft delete for revocation**: Setting revokedAt instead of deleting the row preserves the audit trail and makes the revocation check simple.

## What Didn't Work

- **Import sort order**: The initial implementation had `{ eq, and }` import order which biome's organizeImports flagged. Fixed by sorting to `{ and, eq }`. Minor issue caught during lint verification.
- No other significant blockers. Implementation proceeded as planned with zero plan deviations.

## What Changed in Understanding

No significant changes in understanding. Implementation validated the planned approach. The auth middleware extension pattern (prefix detection → branch) proved clean and extensible — future auth methods (e.g., OAuth tokens, session cookies) could follow the same pattern. The decision to reuse the Bearer header rather than introduce a separate X-API-Key header means the existing dashboard useApiFetch hook and Authorization header injection would work with API keys without modification.

## Product Changes

No product definition changes this cycle. API key management was already listed as a feature in product.md ("API key management — System provides API keys for service-to-service authentication"). This cycle implements the base version of that feature. The audit logs page's hardcoded event type dropdown needs updating to include `api_key_created` and `api_key_revoked` — a known maintenance pattern.
