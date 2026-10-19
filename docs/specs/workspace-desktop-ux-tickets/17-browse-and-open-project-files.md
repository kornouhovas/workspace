<!-- workspace-desktop-ux:U17 -->

# U17: Browse real project files and open them in native applications

Publication state: published as https://github.com/kornouhovas/workspace/issues/64 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Browse the displayed project tree, Open a file in its default external application and separately Reveal an item in Finder/Explorer.

Specification acceptance: UX14, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] List real folders/files with expansion, refresh and loading/empty/error/unavailable states in preview and expanded project modes; late reads cannot replace a newer project.
- [ ] Add narrow typed service/native commands with fresh logical-project, containment and availability validation. Reject traversal, foreign identity and unsafe links without granting renderer filesystem access.
- [ ] Open uses the OS default external application; Reveal is a separate action with correct file-manager behavior on macOS and Windows. No embedded viewer/editor or general file mutation is introduced.
- [ ] Handle disappearing files, unavailable sources, native failures and project moves using current authorized state; expose bounded actionable errors.
- [ ] Verify contained real temporary filesystem queries and rejected access at the public boundary, actual platform Open/Reveal, long paths, tree keyboard behavior and focus at both sizes.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #54: Preview and expand one project with unique retained tabs

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

Inherited acceptance from #14, #15, #17, #18, #19: availability/identity reconciliation, native authorization, containment, IPC isolation and Open/Reveal separation; add tree/Open scenarios where no prior command exists.
