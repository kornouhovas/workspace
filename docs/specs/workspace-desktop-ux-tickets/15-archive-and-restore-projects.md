<!-- workspace-desktop-ux:U15 -->

# U15: Archive and restore projects from the working area

Publication state: published as https://github.com/kornouhovas/workspace/issues/62 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Switch Active/Archived in the workspace, archive or restore from project menus and retain editable metadata and identity.

Specification acceptance: UX08, UX09, UX15, UX16. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Expose Active/Archived in the working area and contextual Archive/Restore in applicable Table, Board and project menus, with current eligibility.
- [ ] Archive uses the designated source-contained location and original relative placement; retain project identity, ordinary values and retained tabs.
- [ ] Restore handles occupied targets, missing parents and incompatible modes through existing explicit choices; no overwrite, guessed destination or silent bulk relocation.
- [ ] Archived ordinary properties remain editable; folder-backed category stays fixed until restoration. Compose with shared editors once #56/#57 land, verified by #67.
- [ ] Show path consequences, pending/uncertain status and Details/Recover with current review/operation identity. Verify disposable filesystem restart and error cases.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

- #60: Create, rename and reveal projects from contextual controls
- #50: Configure shared sources through reviewed bb-style settings

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

Inherited acceptance from #22: relative archive placement, explicit restore decisions, retained identity/values and archived-category restrictions.
