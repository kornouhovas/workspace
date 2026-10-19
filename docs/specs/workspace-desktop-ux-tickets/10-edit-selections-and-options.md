<!-- workspace-desktop-ux:U10 -->

# U10: Edit selections and ordinary option presentation consistently

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Choose Single Select/MultiSelect values and manage ordinary options from the same compact editors across all working surfaces.

Specification acceptance: UX09, UX10, UX11, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Single Select choice commits immediately. Each MultiSelect toggle commits while the menu remains open; closing either menu does not undo committed changes.
- [ ] Preserve set semantics, empty transitions, validation, busy/error feedback and rapid-toggle ordering. Failed saves do not pretend success or lose the current selection.
- [ ] Provide ordinary option create/rename/color/reorder and workspace-local hiding. Source-wide labels/colors/order/values update sibling workspaces without leaking option hiding.
- [ ] Already selected hidden options remain visible and removable but are absent from ordinary new choices; field visibility remains view-local.
- [ ] Integrate pending-save navigation behavior and focus/Escape ownership in Table, Board and project details. Folder-backed Select retains filesystem commands rather than ordinary metadata mutation.
- [ ] Option deletion impact review is delivered by U11; retain the current safe deletion path until then.

## Blocked by

- U09: Edit Text, Number and Date without losing drafts during navigation

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
