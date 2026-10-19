<!-- workspace-desktop-ux:U14 -->

# U14: Move projects and manage folder-backed categories contextually

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Change a project category and create, rename or remove category options through reviewed contextual filesystem operations.

Specification acceptance: UX11, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Move an active grouped project to a valid category using current filesystem commands; reject empty/ineligible destinations and preserve identity/ordinary values.
- [ ] Rename the folder-backed property label without renaming folders; distinguish it from category option create/rename actions that change real folders.
- [ ] Expose category creation and reviewed category rename with affected-project/path information and existing non-overwrite semantics.
- [ ] Deleting an occupied category requires an explicit destination and the current impact review. Do not implicitly delete projects or reuse stale review results.
- [ ] Use compact pending/status/recovery surfaces across working contexts; interruption and uncertain results preserve existing operation identity and explicit recovery routes.
- [ ] Verify shared source effects, external category changes, unavailable/invalid destinations, collisions and recovery without translating authored names or paths.

## Blocked by

- U13: Create, rename and reveal projects from contextual controls

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
