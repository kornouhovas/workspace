<!-- workspace-desktop-ux:U09 -->

# U09: Edit Text, Number and Date without losing drafts during navigation

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Edit ordinary scalar values consistently in Table, Board cards and project details, with navigation that saves valid input or retains an invalid draft.

Specification acceptance: UX03, UX09, UX10, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Text Enter inserts a newline; Cmd/Ctrl+Enter or blur commits; Escape cancels an uncommitted draft. Preserve empty-string versus absent-value semantics through the existing clear command.
- [ ] Number and manual Date commit on Enter/blur and cancel on Escape. Number arithmetic stores only the result (10+5 reopens as 15); keep service validation and Date timezone semantics.
- [ ] Calendar selection commits immediately; closing the picker never reverts a committed choice.
- [ ] Before switching project/workspace or closing the project area, save valid pending input. Invalid or failed saves retain the draft and block transition until correction or explicit cancellation.
- [ ] Prevent duplicate Enter/blur submissions, stale response overwrites and blind mutation retry. Same-source refresh and delayed events retain valid draft/revision ownership.
- [ ] Integrate shared editors in all three surfaces, preserving focus, Escape ownership and accessibility. Verify failure/retry/cancel and rapid transition scenarios through public service and UI seams.

## Blocked by

- U07: Preview and expand one project with unique retained tabs

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
