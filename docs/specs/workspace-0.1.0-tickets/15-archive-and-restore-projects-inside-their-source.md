# T15: Archive and restore projects inside their source

Approved and published: [GitHub #22](https://github.com/kornouhovas/workspace/issues/22); Archived Beads ID: `workspace-31i.15`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Choose an archive folder, archive a project with its original relative placement preserved, edit ordinary metadata there, and restore it safely.

Roadmap scope: M2. Specification user stories: 33, 34, 35, 36, 37, 38, 39.

## Acceptance criteria

- [ ] The selected archive is inside the source and excluded from active discovery. Define selection/default and subsequent-location-change rules without automatic bulk relocation.
- [ ] Archive mirrors original relative placement, preserves identity/ordinary properties and switches visibility between Active and Archived; archived folder-backed category stays fixed.
- [ ] Restore returns to the original location. Occupied paths and missing parents require an explicit recovery choice; archive-time collisions never overwrite or silently rename.
- [ ] Ordinary Text edits made while archived survive restore; source mode changes do not delete archived records or invent a new restore target.
- [ ] Direct/grouped, source-unavailable and interrupted archive/restore flows pass service/UI and restart checks using real temporary folders.

## Blocked by

- [T09 / GitHub #16](https://github.com/kornouhovas/workspace/issues/16): Change discovery mode with a non-destructive preview
- [T12 / GitHub #19](https://github.com/kornouhovas/workspace/issues/19): Move projects by editing folder-backed Select

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
