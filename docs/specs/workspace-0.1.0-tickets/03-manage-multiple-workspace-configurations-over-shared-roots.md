# T03: Manage multiple workspace configurations over shared roots

Approved and published: [GitHub #10](https://github.com/kornouhovas/workspace/issues/10); Beads execution step: `workspace-31i.3`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create separate workspaces over the same root, switch between them, rename/reorder them and remove a configuration without deleting source data or project files.

Roadmap scope: M2. Specification user stories: 4, 5, 7, 8, 9, 18.

## Acceptance criteria

- [ ] A second workspace over an existing root receives its own workspace/view identifiers while referencing the same source; a different root is isolated.
- [ ] Selection, names and workspace order survive restart; each workspace retains its own presentation configuration.
- [ ] Removing any workspace, including the last reference, deletes no external folders and does not silently discard retained source/project metadata.
- [ ] Invalid or stale workspace commands fail without changing another workspace; shared-source changes notify all referencing configurations.
- [ ] Service and UI scenarios exercise same-root and different-root configurations and removal using temporary roots.

## Blocked by

- [T02 / GitHub #9](https://github.com/kornouhovas/workspace/issues/9): Create and reopen an empty workspace

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
