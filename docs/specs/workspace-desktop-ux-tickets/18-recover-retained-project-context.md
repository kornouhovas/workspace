<!-- workspace-desktop-ux:U18 -->

# U18: Recover unavailable projects without losing retained tabs

Publication state: published as https://github.com/kornouhovas/workspace/issues/65 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Keep a retained project open through exclusions, archive, verified moves or source loss, and reach the correct recovery from its working context.

Specification acceptance: UX07, UX08, UX14, UX15, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Show actual missing, excluded, mode-inactive, archived and unavailable-source states without silently closing tabs or treating a root outage as mass deletion.
- [ ] Verified external rename/move updates the same logical project and refreshed file tree/values; ambiguous/copy/replacement cases retain metadata and use explicit reviewed reassociation.
- [ ] Offer Details/Recover, source settings and applicable retry/refresh actions from contextual status. Archived ordinary editing remains available; unsafe filesystem actions are unavailable.
- [ ] Keep settings and app-data recovery reachable when no project/source can be opened; recovery respects selected-source containment and current review tokens.
- [ ] Restart or restore a saved session, then revalidate current availability. Exercise delayed reads, switching during recovery and stale outcomes without reactivating old content or replaying mutations.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #55: Resume and back up device-local workspace sessions
- #61: Move projects and manage folder-backed categories contextually
- #62: Archive and restore projects from the working area
- #64: Browse real project files and open them in native applications

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

Inherited acceptance from #14, #15, #16, #19, #22: reassociation, external moves/replacements, unavailable-source behavior, mode inactivity, archive states and preserved identity.
