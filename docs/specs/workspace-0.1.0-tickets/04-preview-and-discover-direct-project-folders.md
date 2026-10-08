# T04: Preview and discover direct project folders

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Preview immediate child folders as projects, exclude unwanted folders, then apply the preview and see the projects by name in the default Table.

Roadmap scope: M2. Specification user stories: 10, 12, 13, 14, 15, 23.

## Acceptance criteria

- [ ] Preview and apply agree on direct-mode projects; manual exclusions persist and excluded content remains untouched.
- [ ] Symbolic links, hidden service folders and any designated archive are excluded; scanning stops at a recognized project and does not expose its nested folders as projects.
- [ ] Project records receive logical IDs and local path/native-identity evidence without writing permanent marker files; unchanged rescans and restart retain those IDs.
- [ ] Cancelling a preview leaves configuration unchanged. Filesystem changes between preview and apply trigger validated current-state handling instead of applying a stale unsafe plan.
- [ ] Empty, unreadable and unavailable roots produce meaningful UI states; service tests use real temporary directories including links and nested content.

## Blocked by

- T02: Create and reopen an empty workspace

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
