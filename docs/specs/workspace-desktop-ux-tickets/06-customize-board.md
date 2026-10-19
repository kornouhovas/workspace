<!-- workspace-desktop-ux:U06 -->

# U06: Work with grouped Boards and contextual card controls

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Use a populated Board whose columns and cards reflect saved grouping and presentation settings, including multiple memberships.

Specification acceptance: UX11, UX12, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Render actual projects and typed values in cards with working existing editing routes and controls for card property presentation.
- [ ] Expose grouping by supported types or none, exact scalar groups, Select/category groups, empty groups and MultiSelect multiple membership.
- [ ] Support default/ascending/descending/manual group order, hide/collapse/hide-empty, column order/visibility/width and content wrapping with saved view scope.
- [ ] Keep column ordering separate from value-changing group assignment; filtered/sorted content must remain consistent with actual data.
- [ ] Provide pointer/keyboard alternatives and inspect populated/empty/error Boards, long content, portals and independent scroll at both sizes/languages/themes.

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
