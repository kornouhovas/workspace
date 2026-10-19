<!-- workspace-desktop-ux:U05 -->

# U05: Work with grouped Tables and contextual column controls

Publication state: published as https://github.com/kornouhovas/workspace/issues/52 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Use a full working Table with exact grouping, contextual property presentation, row ordering and persistent column layout.

Specification acceptance: UX11, UX12, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Render actual typed values with loading/empty/error states; maintain existing editing routes while new shared editors are introduced later.
- [ ] Expose grouping by supported types or none, exact scalar groups, Select/category groups and MultiSelect membership through contextual controls.
- [ ] Support default/ascending/descending/manual group order, hide/collapse/hide-empty and keyboard equivalents without changing source values.
- [ ] Provide visible-property order, show/hide controls, column widths/wrapping and manual row order with persisted view scope and usable long names/content.
- [ ] Keep order/resize actions distinct from group-value assignment and preserve membership/filter results. Verify paired workspaces/views do not share presentation changes.
- [ ] Inspect narrow/wide Table states, menus/portals, independent scrolling and focus in EN/RU and both themes.

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

Inherited acceptance from #29, #30, #31: exact grouping, MultiSelect membership, Table row/column order, widths and view isolation.
