# T12: Move projects by editing folder-backed Select

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Choose another folder-backed category in a project field and move the real folder while preserving its identity and values.

Roadmap scope: M2. Specification user stories: 18, 22, 23, 27, 29, 32.

## Acceptance criteria

- [ ] An active grouped project moves to the selected existing category and keeps its logical ID and ordinary values after restart.
- [ ] The current category is a safe no-op; empty, unknown, out-of-source or unavailable category destinations are rejected.
- [ ] Occupied target names and permission changes cannot overwrite projects; revalidate source/destination immediately before mutation.
- [ ] Interrupted operations use the established recovery boundary and update all referencing workspaces to actual persisted/filesystem state.
- [ ] The UI clearly identifies the physical move; tests verify file contents, metadata and rejected operations in isolated source fixtures.

## Blocked by

- T11: Rename project folders without losing identity

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
