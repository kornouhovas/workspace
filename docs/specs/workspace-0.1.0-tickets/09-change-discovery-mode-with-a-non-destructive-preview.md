# T09: Change discovery mode with a non-destructive preview

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Switch an existing source between direct and grouped discovery after inspecting a preview, retaining metadata for folders no longer interpreted as projects.

Roadmap scope: M2. Specification user stories: 16, 17, 18.

## Acceptance criteria

- [ ] The preview identifies added, retained and no-longer-recognized projects and the change in folder-backed category availability.
- [ ] Cancel changes neither configuration nor metadata; applying changes no project files or folder placement.
- [ ] Unmatched project records and values are retained for explicit recovery/reassociation; the user can see that retained state rather than losing access to it.
- [ ] The mode applies to every workspace over the source and persists after restart without changing workspace-owned view identity.
- [ ] Revalidate stale previews and show recovery choices rather than guessing associations across different folder depths; temporary-fixture tests verify no filesystem mutation.

## Blocked by

- T06: Preview grouped discovery and expose folder-backed categories
- T07: Recover missing folders and unavailable sources

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
