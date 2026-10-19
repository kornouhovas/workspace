<!-- workspace-desktop-ux:U11 -->

# U11: Manage custom properties and remove metadata with impact review

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Create or rename properties from contextual controls and safely remove custom properties or ordinary options after reviewing affected data/views.

Specification acceptance: UX11, UX12, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Provide create/rename and applicable management actions from Table headers, Board/property controls and project details with shared Radix surfaces. Property types remain immutable.
- [ ] Keep definitions/values/ordinary option labels/colors/order source-wide; preserve workspace-local option hiding and view-local field presentation.
- [ ] Preview custom-property or ordinary-option removal impact on projects and saved-view references, then apply only the current reviewed operation.
- [ ] Stale review, cancellation and failure leave actual data unchanged; success performs the established cleanup without broken filters/grouping/layout or silently deleting files.
- [ ] Verify retained/archived projects and two source-sharing workspaces follow existing service deletion semantics and independent view configuration.

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
