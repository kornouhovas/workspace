# T14: Remove occupied categories with an explicit destination

Approved and published: [GitHub #21](https://github.com/kornouhovas/workspace/issues/21); Archived Beads ID: `workspace-31i.14`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Retire a folder-backed category only after choosing where its projects should go, with clear results when a multi-project move cannot fully complete.

Roadmap scope: M2. Specification user stories: 22, 27, 31.

## Acceptance criteria

- [ ] An occupied category cannot be removed without a valid destination and a preview of affected projects and collisions.
- [ ] Projects are preserved with their logical IDs/values; no operation implicitly deletes project-file contents.
- [ ] Define and expose partial-failure and retry behavior before implementation: per-project outcomes are truthful and retry cannot duplicate or overwrite moved projects.
- [ ] Unexpected files, new projects arriving after preview, permissions and occupied target names prevent unsafe category cleanup; define empty-category removal without expanding project-deletion scope.
- [ ] A restart during the operation leads to observable recovery; all workspaces eventually show actual folder/category state.

## Blocked by

- [T13 / GitHub #20](https://github.com/kornouhovas/workspace/issues/20): Create and rename category folders through Select options

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
