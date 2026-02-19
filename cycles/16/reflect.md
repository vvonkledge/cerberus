# Reflect — Cycle 16

## What Worked

- **Parallel workers with shared interface contract**: Specifying exact TypeScript interfaces (AuthProvider/useAuth, useApiFetch, ProtectedRoute) in both workers' prompts enabled simultaneous work on different files — zero merge conflicts, zero interface mismatches. The key was keeping the interface surface small (3 exports) and precisely defined.
- **Drop-in fetch replacement pattern**: Making `useApiFetch()` return a function with the same signature as `fetch` turned the page migration into a mechanical find-and-replace — just swap `fetch` for `apiFetch` and add the import. This minimized integration risk across all 4 page files.
- **React Router nested route structure for auth**: Using `<ProtectedRoute />` as a parent route wrapping `<Layout />` cleanly separates authentication, layout, and content concerns with no code duplication. The login route sits outside both wrappers, giving it its own full-screen layout.
- **React 19 context pattern**: Using `<AuthContext value={}>` instead of `<AuthContext.Provider value={}>` is cleaner and aligns with modern React idioms.

## What Didn't Work

- **SPA routing limits curl-based integration testing**: The test plan assumed browser-like testing (verify redirect to /login, see form elements, click buttons), but since the dashboard is a SPA, all routes serve the same index.html and React Router handles redirects client-side. curl verified the API auth flow and SPA serving, but UI-level redirect behavior was verified by code review rather than automated interaction.
- **Test depth fell short of plan**: Plan step 8 called for tests covering login flow, protected route redirect, and API client token injection. Without @testing-library/react (not installed), the tests verify module exports and shapes rather than rendering behavior. Adding a DOM testing library is a larger change that should be its own cycle.

## What Changed in Understanding

No assumptions proved wrong. The existing dashboard pages used a consistent fetch pattern that was straightforward to migrate, and React Router's nested route structure worked as expected for auth gating. The codebase is clean enough that the auth integration was a simple layer addition rather than a restructuring. One insight for future cycles: testing SPA client-side behavior requires a headless browser or DOM testing library — curl-based integration testing only covers the API layer and static serving.

## Product Changes

No product definition changes this cycle. Two UX observations were noted for future consideration: (1) there is no feedback when tokens expire — users encounter raw 401 errors and must manually re-login, and (2) there is no admin bootstrap flow in the dashboard — the POST /seed endpoint must be called via curl. These are UX gaps, not changes to the product definition.
