# Issue 28: Search and typed view filters

Base: `aa2b09d3` (`new-workspace`). Tracker and CI/integration checkpoint: [GitHub #28](https://github.com/kornouhovas/workspace/issues/28).

## Contract

Each view owns `{search, rules}`. Search is a trimmed, case-insensitive project-name substring. Search AND every rule must match. An empty rule list imposes no restriction. Selection operands use stable option/category IDs, never display names. `any` ORs chosen values; `all` requires every value (MultiSelect only); `none` excludes every chosen value. A null entry in a selection operand explicitly includes the empty bucket. This preserves the historical `filterProjectsForView` / `matchesValueVisibility` behavior in `src/workspaceViews.js` at historical commit `3723fa8d`, while extending ordinary scalar types. No code is copied from bb.

| Property | Operators | Operand |
| --- | --- | --- |
| Name, Text | equals, not_equals, contains, not_contains, empty, not_empty | Exact authored string for comparisons; null for emptiness |
| Number | equals, not_equals, gt, gte, lt, lte, empty, not_empty | Finite number, not an expression; null for emptiness |
| Date | equals, not_equals, gt, gte, lt, lte, empty, not_empty | Valid Gregorian YYYY-MM-DD; null for emptiness |
| Folder-backed Select, Single Select | any, none, empty, not_empty | Nonempty unique option-ID/null array; null for emptiness |
| MultiSelect | any, none, all, empty, not_empty | Nonempty unique option-ID/null array; null for emptiness |

Text comparisons and Name matching are case-insensitive without trimming authored operands or values. Empty means missing/null, zero-length Text, or an empty membership set. Whitespace Text is not empty; Number zero is not empty. Scalar negative comparisons also exclude missing values; use explicit emptiness conditions for those. Name is never empty in valid project data. Date ordering uses calendar days with no timezone conversion. Multiple conditions for one property also combine with AND; `any` including null expresses value-or-empty.

The service validates exact request shapes, ownership, type/operator compatibility, date/number operands, set uniqueness and option-to-property/source bindings. Rules targeting unavailable properties (including a dormant category property after a mode change) fail visibly without rewriting configuration. Hidden options remain valid filter references because visibility does not delete values. Persisted malformed JSON/configuration fails closed; explicit Clear replaces it. A stale but structurally valid configuration remains readable for editing/removal. Duplication copies exact saved configuration into an independent view row. Layout changes do not alter it. Active/Archived share the view configuration but query their own lifecycle projections; retained source associations remain available within the active projection's existing recovery semantics.

## Public seams and scenarios

The originating issue and specification agree the seams: typed Workspace service with real temporary SQLite/filesystem data, production IPC, and UI interaction. Migration 0019 adds a default empty filter configuration to existing views.

- Search/case/trim and typed combinations; literal expected project IDs across every ordinary type/operator, explicit empty sets, zero, whitespace and leap dates.
- Folder-backed IDs, mode-change stale references, hidden selection options, option ownership, malformed operands, failed save rollback and corruption repair.
- Independent workspace settings/duplicate settings and reopen; saved configuration survives layout changes and lifecycle projection changes.
- Real edits refresh membership; query/load/save errors do not fabricate results or silently drop rules.
- EN/RU keyboard search/conditions/save/clear/Escape; both layouts, empty guidance and query retry.
- Migration inventory/build/package fixtures and pre-filter upgrade/reopen; focused service/IPC/UI checks, typecheck/lint/docs, visual inspection, two-axis review, then full suite.

No synchronization, AI, remote access, website or legacy import. Platform/human acceptance and exact-SHA CI results belong to the linked issue checkpoint; a local automated result does not establish all-platform acceptance.
