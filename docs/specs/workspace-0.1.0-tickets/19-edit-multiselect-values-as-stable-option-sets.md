# T19: Edit MultiSelect values as stable option sets

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Assign several ordinary Select options to a project, remove individual memberships or clear them all without duplicating the project.

Roadmap scope: M3. Specification user stories: 40, 42, 43, 44, 45, 53.

## Acceptance criteria

- [ ] MultiSelect definitions and option presentation reuse the ordinary-option behavior while keeping the type immutable.
- [ ] Add/remove/clear memberships through a keyboard-accessible editor; duplicate and foreign option IDs are rejected or normalized according to an explicit set contract.
- [ ] Renaming an option preserves memberships; hiding it does not silently remove it from a project.
- [ ] Memberships persist after restart and are shared by sibling workspaces; edits never move folders or create duplicate project records.
- [ ] Service tests include empty and multi-option sets, failed saves and unchanged other-source values.

## Blocked by

- T18: Edit ordinary Single Select values and option presentation

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
