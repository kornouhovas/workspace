<!-- workspace-desktop-ux:U10 -->

# U10: Edit selections and ordinary option presentation consistently

Publication state: published as https://github.com/kornouhovas/workspace/issues/57 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Choose Single Select/MultiSelect values and manage ordinary options from the same compact editors across all working surfaces.

Specification acceptance: UX09, UX10, UX11, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Single Select choice commits immediately. Each MultiSelect toggle commits while the menu remains open; closing either menu does not undo committed changes.
- [ ] Preserve set semantics, empty transitions, validation, busy/error feedback and rapid-toggle ordering. Failed saves do not pretend success or lose the current selection.
- [ ] Provide ordinary option create/rename/color/reorder and workspace-local hiding. Source-wide labels/colors/order/values update sibling workspaces without leaking option hiding.
- [ ] Already selected hidden options remain visible and removable but are absent from ordinary new choices; field visibility remains view-local.
- [ ] Integrate pending-save navigation behavior and focus/Escape ownership in Table, Board and project details. Folder-backed Select retains filesystem commands rather than ordinary metadata mutation.
- [ ] Option deletion impact review is delivered by #58; retain the current safe deletion path until then.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #56: Edit Text, Number and Date without losing drafts during navigation

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

Inherited acceptance from #25, #26: Single Select/MultiSelect set semantics, hidden chosen options, option scope, delayed responses and keyboard/persistence.
