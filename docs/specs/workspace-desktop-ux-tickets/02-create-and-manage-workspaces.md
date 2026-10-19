<!-- workspace-desktop-ux:U02 -->

# U02: Create and manage automatically named workspaces from the sidebar

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Add a workspace from a folder picker, start or postpone source setup, and rename/reorder/remove it through sidebar menus or workspace settings.

Specification acceptance: UX01, UX02, UX16. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Create with automatic name Workspace and a default Table, without a name prompt; cancellation before folder selection creates nothing. Multiple identical names retain distinct IDs.
- [ ] Reuse a configured source without changing its projects, values or interpretation. For an unconfigured source, offer the existing discovery preview/exclusion/Apply journey and Set up later.
- [ ] Postponing or cancelling setup after creation retains the saved workspace and provides a route back to unfinished setup; do not claim atomic rollback of creation plus discovery.
- [ ] Provide rename, reorder and remove through sidebar/contextual Workspaces list/detail controls with persistence and keyboard alternatives. Removal preserves project files and retained source metadata, including last-reference behavior.
- [ ] Route workspace-context Settings directly to the matching detail. Switching and removing active workspaces produce valid selections and do not leak independent view configuration.

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
