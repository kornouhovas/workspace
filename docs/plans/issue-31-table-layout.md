# Issue 31: Table layout and manual row order

Base: `75c8aa07` (`new-workspace`). Tracker: [GitHub #31](https://github.com/kornouhovas/workspace/issues/31).

## Contract

A Table view owns its column order, hidden columns, widths (120–800 CSS pixels), Text wrapping and manual logical-project order. Name remains visible to preserve identity and recovery actions. Reveal remains a separate action column. Unconfigured/new properties append in source definition order. Dormant category settings are retained across discovery-mode changes. No definition, value or filesystem mutation is introduced.

Rows use one logical-project order across active/archived and grouped/filtered projections. Saved IDs retain their positions when missing or filtered out; new identities append in the existing discovery order. Moving a displayed row relative to another changes only those positions in the complete order and retains undisplayed IDs. Group membership and filters do not change. Row dragging has a dedicated handle and payload; it never assigns a property value. Keyboard earlier/later controls perform the same operation. Duplicates copy settings and diverge; sibling workspaces stay independent.

## Scenarios and public verification seams

The originating issue specifies typed service with disposable real SQLite/filesystem fixtures, IPC and focused keyboard UI interactions. Apply TDD at these established seams.

- Save/reopen layout and manual order; retain missing IDs, append newly discovered projects, filter/group by the same identities.
- Hide/show/reorder columns, bounded widths, Text wrap; preserve exact values/definitions.
- Duplicate and sibling independence; reject foreign view/property/project IDs and malformed inputs without writes/events.
- Migration preserves existing views, filters, grouping, values, identity and active selection; repair invalid config only by explicit reset.
- EN/RU keyboard controls, drag isolation, narrow horizontal scrolling, pending/error/retry states and delayed-response ownership.
- Focused service/UI/IPC checks, migration suite, typecheck/lint/docs, independent two-axis review, full suite and visual runtime inspection.

The owner explicitly authorized publication of issue #31 work in the current public repository. CI/integration acceptance belongs in the GitHub checkpoint.
