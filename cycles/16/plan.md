# Plan — Cycle 16

## Approach

Add an auth context provider that holds the JWT in React state, build a login page component, wrap existing routes in a protected route that redirects to login if no token, and inject the token into all fetch calls via a shared API client.

## Steps

1. Create an AuthContext provider that stores the JWT access token in React state, with login() and logout() functions
2. Build a login page component with email and password fields that calls POST /login and stores the returned token via AuthContext
3. Create a shared API client (e.g. apiFetch wrapper) that reads the token from AuthContext and adds it as an Authorization: Bearer header to all requests
4. Create a ProtectedRoute wrapper component that checks AuthContext for a token and redirects to /login if absent
5. Wrap all existing dashboard routes with ProtectedRoute
6. Update existing dashboard pages to use the shared API client instead of raw fetch
7. Add a logout button to the navigation layout that clears the token from AuthContext and redirects to /login
8. Write tests for login flow, protected route redirect, and API client token injection

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: Existing dashboard pages may use different fetch patterns that are hard to unify into one API client — mitigation: audit all fetch calls first
- Unknown: Not sure how React Router v6 handles redirect from protected routes during initial render
- Risk: Login page needs to handle API error responses (wrong password, rate limited) gracefully — mitigation: map known error codes to user-friendly messages

## First Move

Audit all existing fetch calls in the dashboard to understand current patterns before building the API client.
