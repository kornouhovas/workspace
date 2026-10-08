# T02: Create and reopen an empty workspace

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Select a real empty project root, name a workspace, close the application and reopen the same workspace with a default Table view. This establishes the smallest complete workspace experience.

Roadmap scope: M1. Specification user stories: 3, 9, 56, 73.

## Acceptance criteria

- [ ] The native root picker and create action persist distinct source, workspace and default-view identifiers; reopening retains the name, root association and active view.
- [ ] Cancellation, invalid roots and permission errors create no half-configured workspace and show an actionable state.
- [ ] The empty view has useful guidance; the feature does not claim project discovery before its later ticket.
- [ ] Canonical root association and source containment are enforced behind the service; paths are locators, not logical identifiers.
- [ ] A packaged development app on each target OS passes the create/quit/reopen flow with isolated data; service restart tests verify the persisted relationship.

## Blocked by

- T01: Launch desktop and persist the interface language

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
