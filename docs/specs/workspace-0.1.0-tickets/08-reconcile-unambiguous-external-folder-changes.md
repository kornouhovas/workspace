# T08: Reconcile unambiguous external folder changes

Approved and published: [GitHub #15](https://github.com/kornouhovas/workspace/issues/15); Beads execution step: `workspace-31i.8`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Rename or move a project in the file manager and have Workspace reconcile it when local evidence is unambiguous, while uncertain cases use the existing recovery flow.

Roadmap scope: M2. Specification user stories: 23, 24, 25, 26, 27.

## Acceptance criteria

- [ ] Record local identity matching rules, including native-ID reuse, copied/replaced folders, volume changes and platform case differences; do not treat filesystem IDs as portable project IDs.
- [ ] Explicit refresh and the selected filesystem-change notification mechanism reconcile supported external moves/renames in direct and grouped sources while preserving logical identity and values.
- [ ] External category changes update the folder-backed projection when unambiguous; project contents are not rescanned as nested projects.
- [ ] A new folder at an old path never inherits old properties solely from that path; ambiguous/cross-volume evidence retains the unresolved record and offers reassociation.
- [ ] Tests include events missed during shutdown, restart/rescan, unavailable roots and source containment on actual macOS/Windows fixtures.

## Blocked by

- [T06 / GitHub #13](https://github.com/kornouhovas/workspace/issues/13): Preview grouped discovery and expose folder-backed categories
- [T07 / GitHub #14](https://github.com/kornouhovas/workspace/issues/14): Recover missing folders and unavailable sources

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
