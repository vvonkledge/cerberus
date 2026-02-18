# Plan — Cycle 09

## Approach

Add missing GET endpoints to the API first (GET /roles, GET /users), then build React pages that fetch from those endpoints — roles page, permissions panel, user-roles page.

## Steps

1. Add GET /roles endpoint returning all roles with their permissions
2. Add GET /users endpoint returning all users
3. Set up React Router with nav layout and routes for roles page and users page
4. Build roles page: list all roles, form to create a new role
5. Build role detail view: show role's permissions, form to assign a permission string
6. Build users page: list users, view a user's resolved permissions, form to assign a role to a user

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: React Router client-side routing inside a Hono-served Worker could have path conflicts
- Unknown: Not sure how the current dashboard is wired into the Hono app — need to inspect before assuming React Router will just work

## First Move

Read how the React dashboard is currently served from the Hono Worker to understand the routing setup before adding React Router.
