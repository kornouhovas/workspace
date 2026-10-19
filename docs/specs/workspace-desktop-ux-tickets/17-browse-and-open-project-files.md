<!-- workspace-desktop-ux:U17 -->

# U17: Browse real project files and open them in native applications

Publication state: proposed; not a published issue or an execution checkpoint.

## Parent

Workspace desktop experience specification (new GitHub issue pending publication),
under release specification #7. Resolve the real parent identifier on publication.

## What to build

Browse the displayed project tree, Open a file in its default external application and separately Reveal an item in Finder/Explorer.

Specification acceptance: UX14, UX17, UX18. Rows shared with other slices require
this ticket's scoped behavior plus integrated verification in U20.

## Acceptance criteria

- [ ] List real folders/files with expansion, refresh and loading/empty/error/unavailable states in preview and expanded project modes; late reads cannot replace a newer project.
- [ ] Add narrow typed service/native commands with fresh logical-project, containment and availability validation. Reject traversal, foreign identity and unsafe links without granting renderer filesystem access.
- [ ] Open uses the OS default external application; Reveal is a separate action with correct file-manager behavior on macOS and Windows. No embedded viewer/editor or general file mutation is introduced.
- [ ] Handle disappearing files, unavailable sources, native failures and project moves using current authorized state; expose bounded actionable errors.
- [ ] Verify contained real temporary filesystem queries and rejected access at the public boundary, actual platform Open/Reveal, long paths, tree keyboard behavior and focus at both sizes.

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
