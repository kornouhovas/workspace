<!-- workspace-desktop-ux:U02 -->

# U02: Create and manage automatically named workspaces from the sidebar

Publication state: published as https://github.com/kornouhovas/workspace/issues/49 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Add a workspace from a folder picker, start or postpone source setup, and rename/reorder/remove it through sidebar menus or workspace settings.

Specification acceptance: UX01, UX02, UX16. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Create with automatic name Workspace and a default Table, without a name prompt; cancellation before folder selection creates nothing. Multiple identical names retain distinct IDs.
- [ ] Reuse a configured source without changing its projects, values or interpretation. For an unconfigured source, offer the existing discovery preview/exclusion/Apply journey and Set up later.
- [ ] Postponing or cancelling setup after creation retains the saved workspace and provides a route back to unfinished setup; do not claim atomic rollback of creation plus discovery.
- [ ] Provide rename, reorder and remove through sidebar/contextual Workspaces list/detail controls with persistence and keyboard alternatives. Removal preserves project files and retained source metadata, including last-reference behavior.
- [ ] Route workspace-context Settings directly to the matching detail. Switching and removing active workspaces produce valid selections and do not leak independent view configuration.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #48: Open real workspaces in the Radix/Tailwind desktop shell

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

Inherited acceptance from #9, #10, #11, #13: workspace creation/removal, configured-source reuse, discovery preview and source/workspace ownership.
