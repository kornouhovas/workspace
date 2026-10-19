<!-- workspace-desktop-ux:U12 -->

# U12: Assign ordinary values through Board and Table group actions

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Move a project between ordinary-property groups using drag or an accessible action, and observe the actual committed projection.

Specification acceptance: UX12, UX13, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Text/Number/Date assign the exact destination value; Single Select assigns or clears using its empty destination.
- [ ] MultiSelect replaces only source membership: A+B from A to C becomes B+C, existing C remains a set member, empty destination clears all, empty to C assigns C.
- [ ] Use identical service commands for pointer drag and keyboard/menu equivalents in both Board and Table. Keep group/row reordering separate.
- [ ] Preserve logical identity and unrelated values; filtered-out results reflect the true projection instead of a fabricated successful card/row position.
- [ ] Handle invalid destinations, pending state, failed operations, drag cancel and competing updates without silent mutation replay or lost accepted edits.

## Blocked by

- U10: Edit selections and ordinary option presentation consistently

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
