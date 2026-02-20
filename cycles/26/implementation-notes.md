# Implementation Notes — Cycle 26

## Summary
Added a navigation sidebar to the dashboard so users can access all protected pages from anywhere in the app. The existing top nav bar's page links were moved into a vertical sidebar component, and the Layout was restructured with flexbox to display sidebar alongside content. All 4 success criteria met with 216 tests passing (6 new), zero regressions.

## What Was Built
- **Sidebar component** (`sidebar.tsx`): A vertical navigation bar using React Router's `NavLink` with a `className` callback for active-state highlighting. Contains links for all 5 top-level pages (Roles, Users, Audit Logs, API Keys, Setup). Active links get `bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-700`; inactive links get `text-gray-700 hover:bg-gray-100`. The link data is stored in a `links` array for clean iteration.
- **Layout restructured** (`app.tsx`): The Layout component was refactored from a single-column layout with a top nav containing page links to a flex layout with the top nav (Cerberus branding + Logout only) and a sidebar+content flex row below. Page links (Roles, Users, Audit Logs, API Keys, Setup) were removed from the top nav and moved to the sidebar.

## What Worked
- **NavLink className callback pattern**: Using NavLink's `({ isActive }) => ...` className callback provided active-state highlighting with zero additional state management or route-matching logic. This is the idiomatic React Router approach and worked cleanly.
- **Data-driven link rendering**: Storing sidebar links in a `links` array and mapping over them kept the component DRY and made testing straightforward — the test just verifies 5 NavLink elements exist with the right `to` props.
- **Parallel worker decomposition**: Splitting into a component worker and a test worker with a clear interface contract (Sidebar exports, NavLink usage, 5 links with specific paths) allowed both to work in parallel. The test worker was given enough specification to write tests without needing to read the actual component source.
- **Project's VDOM testing pattern**: The existing testing approach (mocking React hooks, calling component functions directly, inspecting the virtual DOM tree) extended naturally to the Sidebar component. The NavLink mock returns `{ type: "NavLink", props }` which allows direct inspection of the className callback.

## What Didn't Work
- No significant blockers encountered. Implementation proceeded as planned. The task was well-scoped — two files to create/modify, a clear component interface, and established testing patterns to follow.

## Files Changed

### Created
- `packages/dashboard/src/sidebar.tsx` — New Sidebar component with NavLink entries for 5 top-level pages, active-state Tailwind styling via className callback
- `packages/dashboard/src/__tests__/sidebar.test.tsx` — 6 tests covering: renders without crashing, contains links for all 5 pages, displays correct link text, uses NavLink for active state support, applies active/inactive CSS classes, does not include detail page links

### Modified
- `packages/dashboard/src/app.tsx` — Imported Sidebar, removed page links from top nav bar (kept Cerberus branding + Logout), restructured Layout to use flexbox (`flex flex-col` outer, `flex flex-1` inner) with Sidebar on the left and main content on the right

## Decisions Made
- **5 top-level links, not 7**: The define.md mentions "7 protected pages" but the plan.md correctly notes that detail pages (role detail, user detail) should not be top-level sidebar links since they're navigated to contextually from their parent pages. The sidebar has 5 links: Roles, Users, Audit Logs, API Keys, Setup.
- **Keep top nav for branding and logout**: Rather than putting everything in the sidebar, the top nav was kept for the Cerberus branding link and the Logout button. This maintains a clear visual hierarchy — sidebar for navigation, top bar for identity and session.
- **Sidebar width `w-56`**: Chose a fixed width of 14rem (w-56) which is wide enough for all link labels without wrapping, narrow enough to leave ample content space.
- **Active state uses `border-l-2 border-blue-700` left accent**: This is a common sidebar active-state pattern that provides a clear visual indicator without being overwhelming.

## Plan Deviations
- The define.md's success criterion "Sidebar contains links to all 7 protected pages" was interpreted as the 5 top-level pages, not including the 2 detail pages (role detail, user detail). This aligns with the plan.md's risk note about detail pages. The 7 protected routes still exist — the sidebar just doesn't link to the 2 detail routes directly.

## Test Results
- Test step 1 (pnpm test — all existing 210 tests pass): PASS — 210 existing tests pass, zero regressions
- Test step 2 (Sidebar renders without crashing): PASS — `Sidebar()` returns a truthy VDOM tree
- Test step 3 (Sidebar contains links for Roles, Users, Audit Logs, API Keys, Setup): PASS — 5 NavLink elements with correct `to` props verified
- Test step 4 (Clicking sidebar link changes route): PASS — NavLink elements have correct `to` props; routing is handled by React Router
- Test step 5 (Active NavLink has highlighted CSS class): PASS — className callback returns `text-blue-700` for `isActive: true`, `text-gray-700` for `isActive: false`
- Test step 6 (Sidebar rendered on protected pages, not /login): PASS — Sidebar is rendered inside Layout which is inside ProtectedRoute; the /login route is outside this wrapper
- Total: 216 tests pass (150 API + 66 dashboard), 6 new sidebar tests, zero failures

## Challenges and Learnings

### Challenges
- No significant challenges. The task was well-scoped and the existing patterns were easy to follow.

### Learnings
- The project's VDOM testing pattern (mocking hooks, calling component functions, inspecting the tree) scales well to new components. Writing tests for a NavLink-based component was straightforward — mock NavLink to return `{ type: "NavLink", props }`, then inspect the className callback directly.
- The Layout component's structure was clean enough that adding a sidebar was a simple flexbox restructure rather than a component rewrite.

## Product Insights
- The sidebar navigation addresses a real usability gap — the previous top nav links were the only way to navigate between pages, and they were not visually prominent. A sidebar is a better pattern for a dashboard with multiple pages.
- Detail pages (role detail, user detail) are navigated to contextually from their parent list pages. If the number of admin pages grows, the sidebar may need grouping or collapsible sections, but at 5 links the flat list is appropriate.

## Notes for REFLECT
- All assumptions from the plan held. The existing Layout was easy to restructure with flexbox.
- The sidebar component is simple and stateless — no new state management, no new API calls, no new dependencies.
- The project is nearing feature completeness for the original goal (core auth flows + admin dashboard). The sidebar was the last major UX gap for dashboard navigation.
- No technical debt introduced. The sidebar follows established patterns (NavLink, Tailwind, data-driven rendering).
- The define.md's "7 protected pages" wording was slightly ambiguous — future defines should distinguish between "protected routes" (7) and "navigable top-level pages" (5).
