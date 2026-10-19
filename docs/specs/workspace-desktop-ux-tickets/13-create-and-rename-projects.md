<!-- workspace-desktop-ux:U13 -->

# U13: Create, rename and reveal projects from contextual controls

Publication state: published as https://github.com/kornouhovas/workspace/issues/60 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Create projects in the view action area, or rename and Reveal them from row/card/project menus, with actual operation status.

Specification acceptance: UX14, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Create in direct mode or a valid existing grouped category using current validation, containment and recoverable create commands. Display the resulting logical project in its applicable view.
- [ ] Rename from all applicable project menus through the existing no-replace filesystem boundary; retain project ID, metadata and retained-tab identity.
- [ ] Show relevant paths, validation/blockers and pending/completed/uncertain status in compact Radix dialogs. A lost response uses explicit status/recovery rather than automatic replay.
- [ ] Expose distinct native project Reveal with current authorization on macOS and Windows; availability and native errors are visible.
- [ ] Verify invalid names, occupied destinations, permissions and restart/recovery on disposable folders, plus EN/RU keyboard/focus behavior in both view types and project details.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #54: Preview and expand one project with unique retained tabs

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

Inherited acceptance from #17, #18: recoverable creation, no-replace rename, journal/crash/status/recovery, native Reveal and selected-target evidence.
