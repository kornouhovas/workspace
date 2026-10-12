# T21: Search projects and save typed view filters

Approved and published: [GitHub #28](https://github.com/kornouhovas/workspace/issues/28); Archived Beads ID: `workspace-31i.21`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Search project names and save type-aware filters in Board and Table, including empty-value conditions, with results that update after edits.

Roadmap scope: M3. Specification user stories: 49, 56, 64.

## Acceptance criteria

- [ ] Define supported operators and combination semantics from the preservation baseline for Name, folder-backed Select and all ordinary types; validate filter operands behind the service.
- [ ] Name search and typed filters combine predictably in both layouts; empty Text/Number/Date/Select/MultiSelect cases have explicit observable results.
- [ ] Filter configuration belongs to the view, survives restart and is copied independently when a view is duplicated.
- [ ] Editing a value refreshes membership in the filtered result; malformed or stale filter references do not silently corrupt configuration.
- [ ] Accessible controls, empty-results guidance and query errors are covered by UI checks; service fixtures verify results across all supported types.

## Blocked by

- [T06 / GitHub #13](https://github.com/kornouhovas/workspace/issues/13): Preview grouped discovery and expose folder-backed categories
- [T16 / GitHub #23](https://github.com/kornouhovas/workspace/issues/23): Edit Number properties with arithmetic input
- [T17 / GitHub #24](https://github.com/kornouhovas/workspace/issues/24): Edit Date properties without unintended date shifts
- [T19 / GitHub #26](https://github.com/kornouhovas/workspace/issues/26): Edit MultiSelect values as stable option sets
- [T20 / GitHub #27](https://github.com/kornouhovas/workspace/issues/27): Manage independent Table and Board views

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
