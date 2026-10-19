<!-- workspace-desktop-ux:U13 -->

# U13: Create, rename and reveal projects from contextual controls

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Create projects in the view action area, or rename and Reveal them from row/card/project menus, with actual operation status.

Specification acceptance: UX14, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Create in direct mode or a valid existing grouped category using current validation, containment and recoverable create commands. Display the resulting logical project in its applicable view.
- [ ] Rename from all applicable project menus through the existing no-replace filesystem boundary; retain project ID, metadata and retained-tab identity.
- [ ] Show relevant paths, validation/blockers and pending/completed/uncertain status in compact Radix dialogs. A lost response uses explicit status/recovery rather than automatic replay.
- [ ] Expose distinct native project Reveal with current authorization on macOS and Windows; availability and native errors are visible.
- [ ] Verify invalid names, occupied destinations, permissions and restart/recovery on disposable folders, plus EN/RU keyboard/focus behavior in both view types and project details.

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
