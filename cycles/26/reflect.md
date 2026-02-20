# Reflect — Cycle 26

## What Worked

- **NavLink className callback for active-state highlighting**: Using NavLink's `({ isActive }) => ...` callback provided active-state styling with zero additional state management or route-matching logic. This is idiomatic React Router and produced clean, testable code.
- **Data-driven link rendering**: Storing sidebar links in a `links` array and mapping over them kept the component DRY and made testing straightforward — tests verify 5 NavLink elements exist with the correct `to` props.
- **Parallel worker decomposition**: Splitting into a component worker and a test worker with a clear interface contract (Sidebar exports, NavLink usage, 5 links with specific paths) allowed both to work simultaneously. The test worker wrote tests from a specification without needing to read the actual component source.
- **VDOM testing pattern scales to NavLink**: The project's existing testing approach (mocking hooks, calling component functions directly, inspecting the virtual DOM tree) extended naturally to a NavLink-based component. Mocking NavLink to return `{ type: "NavLink", props }` allows direct inspection of the className callback.
- **Layout was easy to restructure**: The existing Layout component's structure was clean enough that adding a sidebar was a simple flexbox restructure (adding `flex flex-col` outer, `flex flex-1` inner) rather than a full component rewrite.

## What Didn't Work

- No significant blockers encountered. Implementation proceeded as planned.
- One plan deviation: the define.md success criterion "Sidebar contains links to all 7 protected pages" was interpreted as 5 top-level pages, excluding the 2 detail pages (role detail, user detail) which are navigated to contextually from their parent list pages. This aligns with the plan.md's risk note about detail pages.

## What Changed in Understanding

No significant changes in understanding. All assumptions from the plan held — the existing Layout was easy to restructure with flexbox, NavLink worked as expected for active-state highlighting, and the testing pattern scaled to the new component. One minor wording lesson: the define.md's "7 protected pages" was ambiguous because there are 7 protected routes but only 5 navigable top-level pages. Future defines should distinguish between routes and navigable pages. The project is nearing feature completeness for the original goal (core auth flows + admin dashboard); the sidebar was the last major UX gap for dashboard navigation.

## Product Changes

No product definition changes this cycle. The sidebar addresses a usability gap in dashboard navigation but does not change what the product is, who it's for, or what features are in scope.
