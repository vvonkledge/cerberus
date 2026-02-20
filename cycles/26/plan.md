# Plan — Cycle 26

## Approach

Add a Sidebar component using React Router's NavLink for active-state highlighting, render it inside the existing layout component that wraps all protected routes, style with Tailwind.

## Steps

1. Create a Sidebar component with NavLink entries for all 7 protected pages (Roles, Users, Audit Logs, API Keys, Setup, and the detail pages)
2. Add Tailwind styling to the Sidebar with active-state class on the current NavLink
3. Integrate the Sidebar into the existing layout component so it renders alongside page content on all protected routes
4. Write tests for Sidebar rendering, link presence, navigation, and active-state highlighting
5. Run full test suite to confirm zero regressions

## How to Test It

See [test-plan.md](test-plan.md) for the full test runbook.

## Risks and Unknowns

- Risk: The existing layout component might need refactoring to accommodate a sidebar alongside content — mitigation: use CSS flexbox to add sidebar without restructuring
- Unknown: Not sure how detail pages (role detail, user detail) should appear in the sidebar — they may not need top-level links
- Risk: NavLink active matching might incorrectly highlight parent routes for nested paths

## First Move

Read the existing layout component to understand how protected pages are currently wrapped, then create the Sidebar component file.
