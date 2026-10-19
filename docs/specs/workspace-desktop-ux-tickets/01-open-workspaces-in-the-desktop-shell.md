<!-- workspace-desktop-ux:U01 -->

# U01: Open real workspaces in the Radix/Tailwind desktop shell

Publication state: published as https://github.com/kornouhovas/workspace/issues/48 on 2026-10-19; consult GitHub for current execution status.

## Parent

Part of #47: Workspace desktop experience, under release specification #7.

## What to build

Launch into an existing workspace, browse its real Table projects, switch workspaces, change appearance/language in bb-style settings and return to work.

Specification acceptance: UX02, UX16, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in #67.

## Acceptance criteria

- [ ] Integrate pinned compatible Radix Primitives and Tailwind versions with shared semantic tokens, typography, density and accessible controls adapted selectively from bb; record actual provenance and retain notices.
- [ ] Display a viewport-bound sidebar and working area with independently scrolling real project content. Retain working legacy feature entry points during the incremental migration; do not replace them with dead controls.
- [ ] Select existing workspaces through the sidebar and load their saved active view/data through current services. Empty, loading, backend-failure and unavailable-source states remain actionable; settings stays reachable.
- [ ] Provide General, Appearance, Workspaces, Sources, Backup and recovery, and About settings navigation, with working General/Appearance controls and Back to workspace. Subsequent tickets replace existing management content inside these sections.
- [ ] Persist EN/RU and Light/Dark/System preferences through the service, react to OS-theme changes, preserve authored text, and restore working context/focus on Back. Remember the last settings section in-session; fresh launch returns to the workspace.
- [ ] Demonstrate the real Table/sidebar/settings journey in both languages/themes and supported sizes, including keyboard-only entry/return. Keep representative shared-control states in Ladle.

- [ ] Reconcile affected inherited tests with this UI change: retain/adapt/replace/retire each affected scenario with a reason and coverage replacement; keep the changed slice and required regression checks passing without deferred broken old-UI tests.

## Blocked by

None (can start after publication and explicit selection).

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

Inherited acceptance from #8, #9, #10: settings/language persistence, backend failure, workspace selection and packaged launch/reopen.
