<!-- workspace-desktop-ux:U07 -->

# U07: Preview and expand one project with unique retained tabs

Publication state: published as https://github.com/kornouhovas/workspace/issues/54 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Open projects from a Table or Board, expand into a unique retained tab, and return or close while preserving the previous view.

Specification acceptance: UX02, UX03, UX04, UX05, UX06, UX07, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] A row/card non-editor click opens one right-hand preview; choosing B replaces A. Editing a property does not also open a preview. Project details show real properties using existing editors.
- [ ] Expand creates/reuses one tab per project within the workspace, displays only that project and retains the sidebar. Selecting a retained tab expands it; selecting a saved view restores its presentation.
- [ ] Return-right removes that project tab, restores the prior view and keeps its preview; other tabs remain. Closing the active expanded tab returns to the prior view. Closing an inactive tab changes no active content.
- [ ] Closing a preview leaves retained tabs unchanged and releases all right-host width. No nested split, duplicate-tab or simultaneous-project commands exist.
- [ ] Implement reorder, close, close others, close to the right and reopen closed with pointer/keyboard alternatives and duplicate protection under rapid interaction.
- [ ] Preserve per-view preview context, filters/grouping and in-session scroll; keep main Back/Forward behavior within the simplified project model. Late requests cannot overwrite or reopen old content.
- [ ] Resize/collapse the sidebar and resize the project area through pointer/keyboard controls within usable bounds. Expand/return restores the previous right width. Persistence is owned by #55.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #52: Work with grouped Tables and contextual column controls
- #53: Work with grouped Boards and contextual card controls

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

### Existing-test migration contract

The tests already present on new-workspace are inherited with the branch; do not
copy historical issue suites into a second tree. Before this slice's edits,
inventory affected scenarios as retained, adapted, replaced or retired. Preserve
valid service/SQLite/filesystem/recovery/IPC/native checks. Update affected UI
locators, fixtures, smoke drivers and suite/CI registration alongside the new
controls, retaining their behavioral assertions. Replace obsolete markup or
explicitly superseded interactions with checks for the accepted contract; record
the reason and coverage replacement. Do not disable failures, relax safety or
performance assertions, or reduce required platform coverage to pass the rewrite.
Use main's tests as scenario evidence only, not as a wholesale suite import.
Run targeted checks during work and the required full suite once on the completed
candidate. Historical focused diagnosis routes are selected only for matching
failures; preserve current ordinary coverage unless a reviewed change replaces it.

Inherited acceptance from #27, #28, #31, #32: view selection, filters/layout, focus, asynchronous selection and main-derived project-tab scenarios reconciled with the accepted no-split/unique-tab rules.
