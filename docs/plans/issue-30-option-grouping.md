# Issue 30: Select and category grouping

Baseline: `7db74028` (`new-workspace`). Tracking: [GitHub #30](https://github.com/kornouhovas/workspace/issues/30).

## Contract

Extend the existing grouping configuration without a schema migration. Ordinary Single Select and MultiSelect use JSON-encoded stable option IDs as keys and current option names as labels. Include every option, including unused and source-hidden options: source option visibility controls pickers, while group visibility belongs to each view. Ordinary selections include No value; folder-backed categories never synthesize an empty category. The owner selected a conditional No value recovery group for retained records lacking a category after Direct → Grouped; it appears only while the unfiltered lifecycle contains such records and is never an active-project destination. Its presentation settings remain view-owned. MultiSelect membership repeats a project ID across its selected groups without duplicating the underlying project or metadata.

Default option order follows source option position; category default order follows deterministic folder-name order. Ascending/descending compare current labels with stable ID ties, keeping No value last. Manual order uses saved keys first and default order for newly introduced groups. Group labels refresh after rename without changing keys or settings. Active category candidates plus categories referenced by the lifecycle projection preserve retained/archived metadata; grouping never moves folders. Direct mode does not expose the folder-backed property. Existing grouping references become visibly unavailable when their property is unavailable.

Grouping settings, hide-empty, hidden/collapsed keys and manual order remain view-owned and independently duplicated. Filters change membership, not group candidates. Source metadata updates refresh every rendered occurrence and sibling view. No new bb code or dependency is copied. The owner authorized publication to the current public repository for this issue.

## Scenarios and seams

The issue explicitly selects typed Workspace service with disposable SQLite/filesystem, production IPC and UI interactions as test seams. Use Matt Pocock TDD at these seams.

- Ordinary Single/Multi empty, unused and hidden options; A+B memberships with one logical ID; updates from either representation.
- Stable IDs through rename/reorder; default/ascending/descending/manual ordering; invalid keys and source ownership.
- View visibility/collapse/hide-empty, filters, duplication independence, source siblings and restart.
- Grouped category physical membership, empty category, category rename/move, archived and retained metadata; no empty active category and no folder effects from ordinary edits.
- EN/RU keyboard UI in Table/Board, metadata edits across occurrences, narrow/wide visual inspection and existing failure/retry handling.
- Focused tests, typecheck/lint/docs, independent Standards/Spec review, final full suite, exact-SHA CI and integration under existing authorization.
