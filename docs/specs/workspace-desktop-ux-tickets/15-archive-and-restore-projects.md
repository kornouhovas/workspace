<!-- workspace-desktop-ux:U15 -->

# U15: Archive and restore projects from the working area

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Switch Active/Archived in the workspace, archive or restore from project menus and retain editable metadata and identity.

Specification acceptance: UX08, UX09, UX15, UX16. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Expose Active/Archived in the working area and contextual Archive/Restore in applicable Table, Board and project menus, with current eligibility.
- [ ] Archive uses the designated source-contained location and original relative placement; retain project identity, ordinary values and retained tabs.
- [ ] Restore handles occupied targets, missing parents and incompatible modes through existing explicit choices; no overwrite, guessed destination or silent bulk relocation.
- [ ] Archived ordinary properties remain editable; folder-backed category stays fixed until restoration. Compose with shared editors once U09/U10 land, verified by U20.
- [ ] Show path consequences, pending/uncertain status and Details/Recover with current review/operation identity. Verify disposable filesystem restart and error cases.

## Blocked by

- U13: Create, rename and reveal projects from contextual controls
- U03: Configure shared sources through reviewed bb-style settings

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
