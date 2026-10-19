<!-- workspace-desktop-ux:U01 -->

# U01: Open real workspaces in the Radix/Tailwind desktop shell

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Launch into an existing workspace, browse its real Table projects, switch workspaces, change appearance/language in bb-style settings and return to work.

Specification acceptance: UX02, UX16, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Integrate pinned compatible Radix Primitives and Tailwind versions with shared semantic tokens, typography, density and accessible controls adapted selectively from bb; record actual provenance and retain notices.
- [ ] Display a viewport-bound sidebar and working area with independently scrolling real project content. Retain working legacy feature entry points during the incremental migration; do not replace them with dead controls.
- [ ] Select existing workspaces through the sidebar and load their saved active view/data through current services. Empty, loading, backend-failure and unavailable-source states remain actionable; settings stays reachable.
- [ ] Provide General, Appearance, Workspaces, Sources, Backup and recovery, and About settings navigation, with working General/Appearance controls and Back to workspace. Subsequent tickets replace existing management content inside these sections.
- [ ] Persist EN/RU and Light/Dark/System preferences through the service, react to OS-theme changes, preserve authored text, and restore working context/focus on Back. Remember the last settings section in-session; fresh launch returns to the workspace.
- [ ] Demonstrate the real Table/sidebar/settings journey in both languages/themes and supported sizes, including keyboard-only entry/return. Keep representative shared-control states in Ladle.

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
