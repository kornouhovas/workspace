<!-- workspace-desktop-ux:U20 -->

# U20: Verify the integrated desktop experience before release acceptance

Publication state: published as https://github.com/kornouhovas/workspace/issues/67 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Demonstrate the complete new interface on the same packaged candidate with all UX scenarios, renewed scale measurements and preserved recovery/safety behavior.

Specification acceptance: UX01, UX02, UX03, UX04, UX05, UX06, UX07, UX08, UX09, UX10, UX11, UX12, UX13, UX14, UX15, UX16, UX17, UX18, UX19, UX20. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Map every UX01–UX20 row and the parent preservation baseline to implementation issues and observable evidence against the same candidate; inherited tests alone do not prove new UI behavior.
- [ ] Inspect Table, Board, preview, expanded project and settings at 1024x720 and 1440x960 in EN/RU and light/dark; separately verify OS System-theme switching, long content, popovers and resize extremes.
- [ ] Complete keyboard-only daily journeys including editor/menu/dialog Escape ownership, draft navigation guards, tab actions, widths, group assignment and contextual operations. Review actual visual fidelity to the pinned bb reference.
- [ ] Run affected service/real-SQLite/filesystem regressions, migration/reopen/session export/restore and complete integrated checks; verify renderer isolation, notices and version consistency.
- [ ] Exercise real macOS and Windows packaged behavior, native Open/Reveal and installer/reopen flows. Preserve supported-environment limits; hosted Windows Server evidence does not establish Windows 11 acceptance.
- [ ] After #41 is accepted, repeat its direct/grouped 1,000-project, 20-property, 10-view scenarios through the finished UI, including project/editor flows: startup and scan <=5,000 ms, interactions <=300 ms, process memory <=1,000,000,000 bytes. Retain raw samples, platform/hardware and actual failures.
- [ ] Provide evidence to release integration #42 without duplicating its release-note/installer ownership, weakening existing blockers, publishing a release or closing #7/#42. Resolve failures within affected implementation scope before acceptance.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #58: Manage custom properties and remove metadata with impact review
- #63: Rename and move folders through accessible group assignment
- #65: Recover unavailable projects without losing retained tabs
- #66: Recover application data and inspect app information in settings
- GitHub #41 (existing performance prerequisite).

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

Inherited acceptance from #8–#40, #41 and #42: complete current regression inventory, integrated runtime/native/install routes and accepted representative-scale measurement harness.
