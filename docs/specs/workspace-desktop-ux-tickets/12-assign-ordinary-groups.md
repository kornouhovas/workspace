<!-- workspace-desktop-ux:U12 -->

# U12: Assign ordinary values through Board and Table group actions

Publication state: published as https://github.com/kornouhovas/workspace/issues/59 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Move a project between ordinary-property groups using drag or an accessible action, and observe the actual committed projection.

Specification acceptance: UX12, UX13, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Text/Number/Date assign the exact destination value; Single Select assigns or clears using its empty destination.
- [ ] MultiSelect replaces only source membership: A+B from A to C becomes B+C, existing C remains a set member, empty destination clears all, empty to C assigns C.
- [ ] Use identical service commands for pointer drag and keyboard/menu equivalents in both Board and Table. Keep group/row reordering separate.
- [ ] Preserve logical identity and unrelated values; filtered-out results reflect the true projection instead of a fabricated successful card/row position.
- [ ] Handle invalid destinations, pending state, failed operations, drag cancel and competing updates without silent mutation replay or lost accepted edits.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #57: Edit selections and ordinary option presentation consistently

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

Inherited acceptance from #33, #34: scalar/Single Select/MultiSelect group assignment, empty transitions, filtered projections and failed-command feedback.
