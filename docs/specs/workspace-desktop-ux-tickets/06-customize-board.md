<!-- workspace-desktop-ux:U06 -->

# U06: Work with grouped Boards and contextual card controls

Publication state: published as https://github.com/kornouhovas/workspace/issues/53 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Use a populated Board whose columns and cards reflect saved grouping and presentation settings, including multiple memberships.

Specification acceptance: UX11, UX12, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Render actual projects and typed values in cards with working existing editing routes and controls for card property presentation.
- [ ] Expose grouping by supported types or none, exact scalar groups, Select/category groups, empty groups and MultiSelect multiple membership.
- [ ] Support default/ascending/descending/manual group order, hide/collapse/hide-empty, column order/visibility/width and content wrapping with saved view scope.
- [ ] Keep column ordering separate from value-changing group assignment; filtered/sorted content must remain consistent with actual data.
- [ ] Provide pointer/keyboard alternatives and inspect populated/empty/error Boards, long content, portals and independent scroll at both sizes/languages/themes.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #51: Manage saved views and find projects through contextual controls

## Verification and boundaries

Exercise the public typed Workspace service with temporary real SQLite and
filesystem fixtures where relevant, plus focused renderer interactions and actual
Electron/platform checks for behavior that those seams cannot prove. Every
changed surface includes EN/RU, keyboard/focus, pending/error/recovery states and
inspection at 1024x720 and 1440x960 in light/dark. Use the shared Radix/Tailwind
foundation and retain applicable provenance/notices. Apply tests to observable
behavior, not component internals or wording.

Reuse current domain, identity, source/workspace ownership, journal/recovery and
renderer-isolation contracts. Only add service/storage changes needed by this
slice; existing backend work is not to be rewritten for visual parity. Preserve
functional entry points until their replacements work. Synchronization, AI,
remote/mobile, nested splits and legacy import remain out of scope.

Start from the latest verified new-workspace integration state, check current
ownership/blockers, and incorporate accepted changes from #41 without reverting
its work. A readiness label does not itself authorize execution.

### Existing-test migration contract

The tests already present on new-workspace are inherited with the branch; do not
copy historical issue suites into a second tree. Before this slice's edits,
inventory affected scenarios as retained, adapted, replaced or retired. Preserve
valid service/SQLite/filesystem/recovery/IPC/native checks. Update affected UI
locators, fixtures, smoke drivers and suite/CI registration alongside the new
controls, retaining their behavioral assertions. Replace obsolete markup or
explicitly superseded interactions with checks for the accepted contract; record
the reason and coverage replacement. Do not disable failures, relax safety or
performance assertions, or reduce required platform coverage to pass the rewrite.
Use main's tests as scenario evidence only, not as a wholesale suite import.
Run targeted checks during work and the required full suite once on the completed
candidate. Historical focused diagnosis routes are selected only for matching
failures; preserve current ordinary coverage unless a reviewed change replaces it.

Inherited acceptance from #29, #30, #32: exact grouping, Board membership/order/visibility/widths/wrapping and view isolation.
