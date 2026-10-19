<!-- workspace-desktop-ux:U03 -->

# U03: Configure shared sources through reviewed bb-style settings

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Resume source setup or change discovery interpretation, exclusions and archive location from source settings with an explicit impact review.

Specification acceptance: UX01, UX08, UX16. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] Provide Sources list/detail with root, availability, affected workspaces, mode/exclusions and archive location. Show the workspace-to-source relationship without inventing separate source data per workspace.
- [ ] Complete direct/grouped preview/exclusions/Apply using current review tokens and real folders; stale review requires a fresh preview, cancel does not mutate configuration or files.
- [ ] Make configured-source mode changes disclose newly recognized, retained and no-longer-recognized projects and apply source-wide effects atomically through existing services.
- [ ] Expose current safe archive designation/change rules, including the accepted empty-only change contract; do not relocate archived content implicitly.
- [ ] Keep source status and explicit Refresh/retry reachable from the working area and settings. Changing source configuration never deletes retained project metadata.
- [ ] Verify two workspaces over one source observe shared configuration while preserving their own views; independently reviewed operations are not submitted by a page-level Save.

## Blocked by

- U02: Create and manage automatically named workspaces from the sidebar

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
