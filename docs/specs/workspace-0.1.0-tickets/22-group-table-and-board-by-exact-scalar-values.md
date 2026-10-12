# T22: Group Table and Board by exact scalar values

Approved and published: [GitHub #29](https://github.com/kornouhovas/workspace/issues/29); Archived Beads ID: `workspace-31i.22`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Group both layouts by Name, Text, Number or Date, control group order/visibility and return to an ungrouped view.

Roadmap scope: M3. Specification user stories: 50, 51, 52, 56.

## Acceptance criteria

- [ ] Exact values define group membership; Number ranges and calendar buckets are not inferred. Define ordinary empty-value grouping explicitly.
- [ ] Default, ascending, descending and manual group order produce stable persisted results, with type-aware comparisons.
- [ ] Hide/show, collapse and hide-empty controls affect the owning view without deleting projects or changing values.
- [ ] Changing grouping and duplicating/reopening a view preserves independent settings; group visibility is distinguished from project filters.
- [ ] Both renderer layouts use the service projection; fixtures test exact-value membership, empty values, order and updates after edits.

## Blocked by

- [T16 / GitHub #23](https://github.com/kornouhovas/workspace/issues/23): Edit Number properties with arithmetic input
- [T17 / GitHub #24](https://github.com/kornouhovas/workspace/issues/24): Edit Date properties without unintended date shifts
- [T20 / GitHub #27](https://github.com/kornouhovas/workspace/issues/27): Manage independent Table and Board views

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
