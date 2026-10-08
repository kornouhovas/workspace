# T10: Create project folders and reveal them in the file manager

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create a new real project folder in a direct source or chosen grouped category, see it in the project list and reveal it in Finder or Explorer.

Roadmap scope: M2. Specification user stories: 19, 20, 21, 22, 27.

## Acceptance criteria

- [ ] Creation in direct mode uses the root; grouped creation requires an existing valid category. The resulting project has a durable logical ID.
- [ ] Invalid platform names, occupied paths, permissions, stale categories and escaping destinations fail without overwriting existing content.
- [ ] Interrupted creation exposes a recoverable state rather than leaving an invisible folder or silently creating duplicate records on retry.
- [ ] Reveal opens the selected real folder through native integration and handles missing/unavailable folders usefully.
- [ ] The UI and service agree after restart; exercise both discovery modes and actual native integration on the target OSes.

## Blocked by

- T06: Preview grouped discovery and expose folder-backed categories

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
