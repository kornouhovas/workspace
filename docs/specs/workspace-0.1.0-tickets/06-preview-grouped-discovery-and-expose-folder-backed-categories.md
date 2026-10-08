# T06: Preview grouped discovery and expose folder-backed categories

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Choose grouped interpretation, preview category folders and their projects, and see the required folder-backed Select in Table.

Roadmap scope: M2. Specification user stories: 11, 12, 14, 15, 18, 20, 28, 32.

## Acceptance criteria

- [ ] Grouped mode recognizes exactly category/project depth; projects are not inferred recursively. Document and test empty categories and mixed-depth preview behavior before applying it.
- [ ] Projects carry the enclosing category value; grouped active projects cannot clear it. Direct sources expose no folder-backed Select.
- [ ] Renaming the category property display label changes metadata only, with no folder renames.
- [ ] Archive/service/link exclusions apply to both levels; invalid or unsafe selections fail before configuration is changed.
- [ ] The source mode/category meaning persists across restart and is visible to all referencing workspaces. This ticket exposes categories but does not yet enable physical category editing.

## Blocked by

- T04: Preview and discover direct project folders

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
