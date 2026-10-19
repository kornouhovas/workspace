<!-- workspace-desktop-ux:U07 -->

# U07: Preview and expand one project with unique retained tabs

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Open projects from a Table or Board, expand into a unique retained tab, and return or close while preserving the previous view.

Specification acceptance: UX02, UX03, UX04, UX05, UX06, UX07, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] A row/card non-editor click opens one right-hand preview; choosing B replaces A. Editing a property does not also open a preview. Project details show real properties using existing editors.
- [ ] Expand creates/reuses one tab per project within the workspace, displays only that project and retains the sidebar. Selecting a retained tab expands it; selecting a saved view restores its presentation.
- [ ] Return-right removes that project tab, restores the prior view and keeps its preview; other tabs remain. Closing the active expanded tab returns to the prior view. Closing an inactive tab changes no active content.
- [ ] Closing a preview leaves retained tabs unchanged and releases all right-host width. No nested split, duplicate-tab or simultaneous-project commands exist.
- [ ] Implement reorder, close, close others, close to the right and reopen closed with pointer/keyboard alternatives and duplicate protection under rapid interaction.
- [ ] Preserve per-view preview context, filters/grouping and in-session scroll; keep main Back/Forward behavior within the simplified project model. Late requests cannot overwrite or reopen old content.
- [ ] Resize/collapse the sidebar and resize the project area through pointer/keyboard controls within usable bounds. Expand/return restores the previous right width. Persistence is owned by U08.

## Blocked by

- U05: Work with grouped Tables and contextual column controls
- U06: Work with grouped Boards and contextual card controls

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
