<!-- workspace-desktop-ux:U09 -->

# U09: Edit Text, Number and Date without losing drafts during navigation

Publication state: published as https://github.com/kornouhovas/workspace/issues/56 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Edit ordinary scalar values consistently in Table, Board cards and project details, with navigation that saves valid input or retains an invalid draft.

Specification acceptance: UX03, UX09, UX10, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Text Enter inserts a newline; Cmd/Ctrl+Enter or blur commits; Escape cancels an uncommitted draft. Preserve empty-string versus absent-value semantics through the existing clear command.
- [ ] Number and manual Date commit on Enter/blur and cancel on Escape. Number arithmetic stores only the result (10+5 reopens as 15); keep service validation and Date timezone semantics.
- [ ] Calendar selection commits immediately; closing the picker never reverts a committed choice.
- [ ] Before switching project/workspace or closing the project area, save valid pending input. Invalid or failed saves retain the draft and block transition until correction or explicit cancellation.
- [ ] Prevent duplicate Enter/blur submissions, stale response overwrites and blind mutation retry. Same-source refresh and delayed events retain valid draft/revision ownership.
- [ ] Integrate shared editors in all three surfaces, preserving focus, Escape ownership and accessibility. Verify failure/retry/cancel and rapid transition scenarios through public service and UI seams.

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

Inherited acceptance from #12, #23, #24, #31, #32: Text empty/absent values, Number expression results, Date validation/timezones, draft focus/lifetimes and real editor smoke routes.
