<!-- workspace-desktop-ux:U05 -->

# U05: Work with grouped Tables and contextual column controls

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Use a full working Table with exact grouping, contextual property presentation, row ordering and persistent column layout.

Specification acceptance: UX11, UX12, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Render actual typed values with loading/empty/error states; maintain existing editing routes while new shared editors are introduced later.
- [ ] Expose grouping by supported types or none, exact scalar groups, Select/category groups and MultiSelect membership through contextual controls.
- [ ] Support default/ascending/descending/manual group order, hide/collapse/hide-empty and keyboard equivalents without changing source values.
- [ ] Provide visible-property order, show/hide controls, column widths/wrapping and manual row order with persisted view scope and usable long names/content.
- [ ] Keep order/resize actions distinct from group-value assignment and preserve membership/filter results. Verify paired workspaces/views do not share presentation changes.
- [ ] Inspect narrow/wide Table states, menus/portals, independent scrolling and focus in EN/RU and both themes.

## Blocked by

- U04: Manage saved views and find projects through contextual controls

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
