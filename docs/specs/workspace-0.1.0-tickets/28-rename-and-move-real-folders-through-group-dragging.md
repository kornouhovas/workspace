# T28: Rename and move real folders through group dragging

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Drag between Name groups to rename a folder or between folder-backed groups to move it, using the existing safe filesystem commands.

Roadmap scope: M3. Specification user stories: 57, 62, 63, 64.

## Acceptance criteria

- [ ] Name destinations invoke the real rename command; empty/invalid names and occupied same-parent paths fail with an explanation.
- [ ] Folder-backed destinations invoke the real category move; there is no empty destination and archived category remains fixed.
- [ ] Both layouts preserve logical project identity and metadata after success/restart; source containment and current-state checks cannot be bypassed by a drag payload.
- [ ] Filtered/ordered projections and sibling workspaces reflect actual operation state; interruption/conflict uses existing recovery rather than optimistic fake success.
- [ ] Interaction and real-filesystem tests cover rename, category move, invalid/colliding destinations, archived projects and cancelled/failed operations.

## Blocked by

- T15: Archive and restore projects inside their source
- T26: Change scalar and Single Select values by group dragging

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
