# T23: Group Select categories and MultiSelect memberships

Approved and published: [GitHub #30](https://github.com/kornouhovas/workspace/issues/30); Beads execution step: `workspace-31i.23`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Group Board and Table by ordinary selections or folder-backed categories, showing MultiSelect projects in each selected group.

Roadmap scope: M3. Specification user stories: 50, 51, 52, 53, 56.

## Acceptance criteria

- [ ] Single Select and MultiSelect include their ordinary empty group; folder-backed Select has no empty active-project destination/category in grouped mode.
- [ ] A project with A+B appears in both groups with one logical ID; editing it from either representation updates every occurrence.
- [ ] Option-backed groups use stable option identity and defined option/default ordering; empty groups, hide/collapse and manual group ordering remain view-owned.
- [ ] Folder category grouping reflects physical placement without turning ordinary Select into a filesystem property.
- [ ] Service and UI tests cover option rename, hidden/empty groups, duplicate views, restart and metadata updates across layouts.

## Blocked by

- [T06 / GitHub #13](https://github.com/kornouhovas/workspace/issues/13): Preview grouped discovery and expose folder-backed categories
- [T19 / GitHub #26](https://github.com/kornouhovas/workspace/issues/26): Edit MultiSelect values as stable option sets
- [T22 / GitHub #29](https://github.com/kornouhovas/workspace/issues/29): Group Table and Board by exact scalar values

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
