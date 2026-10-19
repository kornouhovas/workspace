<!-- workspace-desktop-ux:U08 -->

# U08: Resume and back up device-local workspace sessions

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Restart or restore application data and resume each workspace with its retained tabs, active content and allowed layout state.

Specification acceptance: UX02, UX06, UX07, UX08, UX19. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Persist device/workspace-owned tab order, active view/project, per-view preview context, expanded state, widths and allowed collapse state behind typed services and SQLite migration.
- [ ] Upgrade populated existing data without losing source/property/view/settings data; initialize valid sessions for existing workspaces and remove only a removed workspace session.
- [ ] Restore valid unique tabs and sizes without duplicate or split states; reload current properties and availability instead of persisting data snapshots as live project content.
- [ ] Retain missing/excluded/archived/unavailable-source tabs with explicit status. Reject foreign workspace/project references and prevent stale writes or responses from restoring an obsolete selection.
- [ ] Include session data in existing automatic/pre-migration backups and export/restore. Prove real SQLite reopen/upgrade and backup round trips; invalid/interrupted restore protects existing app data.
- [ ] Backup still excludes project-file contents. Verify two workspaces over one source retain independent sessions. New settings recovery presentation is owned by U19.

## Blocked by

- U07: Preview and expand one project with unique retained tabs

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
