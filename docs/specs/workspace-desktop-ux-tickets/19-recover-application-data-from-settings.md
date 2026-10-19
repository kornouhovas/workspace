<!-- workspace-desktop-ux:U19 -->

# U19: Recover application data and inspect app information in settings

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Inspect backups, export or explicitly restore application data from bb-style settings, then resume a validated workspace session.

Specification acceptance: UX07, UX16, UX19, UX20. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Adapt existing automatic/pre-migration backup status and manual export/restore to the Backup and recovery category; preserve schedule/retention and current restore mechanics.
- [ ] Explain the app-data/project-file boundary and require the existing explicit review for restore; pending/failure feedback does not imply successful replacement.
- [ ] Restore sessions, source metadata, settings and views with real upgrade/backup round trips; invalid/interrupted restoration protects current app data and missing folders remain missing.
- [ ] Make recovery reachable at startup failure or unavailable sources. Restore navigation to actual post-restore state rather than stale session snapshots.
- [ ] Provide About with actual product version and applicable bb/dependency notices; preserve version/package checks and copied-code provenance.
- [ ] Verify settings entry, category memory, Back/focus, independent preference saves, EN/RU and both sizes/themes, including failure dialogs.

## Blocked by

- U08: Resume and back up device-local workspace sessions

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
