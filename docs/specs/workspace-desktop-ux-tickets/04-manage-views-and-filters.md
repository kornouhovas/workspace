<!-- workspace-desktop-ux:U04 -->

# U04: Manage saved views and find projects through contextual controls

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Create or switch saved Table/Board views and use project search and typed filters from the working area, with settings restored on reopen.

Specification acceptance: UX02, UX12, UX16, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Provide view activation, create/rename/reorder/duplicate/delete and final-view protection in tabs/contextual menus, with pointer and keyboard paths.
- [ ] Duplicate views with independent presentation settings; preserve active selection and lifecycle changes across restart and workspace switching.
- [ ] Expose project-name search and typed/empty-value filters in contextual toolbar/popover controls, preserving existing operators and persisted per-view scope.
- [ ] Use current Table and Board renderers as working hosts while later tickets adapt their presentation. Existing values, filters and source changes remain live.
- [ ] Preserve view scroll/selection during settings entry/return and report pending/failure states without fabricated saved configuration.

## Blocked by

- U01: Open real workspaces in the Radix/Tailwind desktop shell

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
