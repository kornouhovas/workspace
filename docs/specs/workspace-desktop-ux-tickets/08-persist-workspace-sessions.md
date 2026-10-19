<!-- workspace-desktop-ux:U08 -->

# U08: Resume and back up device-local workspace sessions

Publication state: published as https://github.com/kornouhovas/workspace/issues/55 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Restart or restore application data and resume each workspace with its retained tabs, active content and allowed layout state.

Specification acceptance: UX02, UX06, UX07, UX08, UX19. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Persist device/workspace-owned tab order, active view/project, per-view preview context, expanded state, widths and allowed collapse state behind typed services and SQLite migration.
- [ ] Upgrade populated existing data without losing source/property/view/settings data; initialize valid sessions for existing workspaces and remove only a removed workspace session.
- [ ] Restore valid unique tabs and sizes without duplicate or split states; reload current properties and availability instead of persisting data snapshots as live project content.
- [ ] Retain missing/excluded/archived/unavailable-source tabs with explicit status. Reject foreign workspace/project references and prevent stale writes or responses from restoring an obsolete selection.
- [ ] Include session data in existing automatic/pre-migration backups and export/restore. Prove real SQLite reopen/upgrade and backup round trips; invalid/interrupted restore protects existing app data.
- [ ] Backup still excludes project-file contents. Verify two workspaces over one source retain independent sessions. New settings recovery presentation is owned by #66.

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

Inherited acceptance from #10, #27, #37, #38: workspace/view persistence, real database upgrades, backup/export/restore and invalid/interrupted recovery.
