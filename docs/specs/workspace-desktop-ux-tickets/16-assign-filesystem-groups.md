<!-- workspace-desktop-ux:U16 -->

# U16: Rename and move folders through accessible group assignment

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Assign a Name or folder-backed category group in Board/Table using the same safe operations as explicit contextual commands.

Specification acceptance: UX13, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] A Name-group assignment performs a real rename; reject empty/invalid names and occupied same-parent destinations without changing logical identity.
- [ ] Folder-backed Select assignment performs a validated physical move; grouped mode has no empty destination and archived category is fixed.
- [ ] Pointer and accessible equivalent controls use the existing reviewed/status/recovery routes, preserving source containment and non-overwrite behavior.
- [ ] Keep reordering distinct from value/location changes; handle filtered results, collisions, cancellation, uncertain response and interrupted/restarted operations with actual outcomes.
- [ ] Run the complete parent-spec all-type assignment matrix together with U12, including MultiSelect and empty transitions, across both working views.

## Blocked by

- U12: Assign ordinary values through Board and Table group actions
- U14: Move projects and manage folder-backed categories contextually
- U15: Archive and restore projects from the working area

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
