# Issue 34: MultiSelect group dragging

Baseline: `9905ba3f` (`new-workspace`). Scope and delivery checkpoints: [GitHub #34](https://github.com/kornouhovas/workspace/issues/34).

## Contract and scenarios

The issue selects the typed Workspace service with real temporary SQLite/filesystem fixtures, IPC and both layout interactions as the agreed TDD seams. The owner authorized publication for #34 in the current public repository.

- Capture the actual rendered source group for each occurrence. Replace A in A+B with C to yield B+C; A to B yields B once; empty clears all; empty to C sets C. Same-group drops are no-ops.
- Validate fresh view ownership/grouping, lifecycle, source membership and destination before mutation. Stale/foreign/deleted/hidden destinations fail without losing unrelated memberships. Read current source-owned values, preserving concurrent unrelated additions.
- Persist using the existing transactional MultiSelect setter; revisions/events refresh source siblings and filtered projections. Keep filesystem, row order and group order unchanged. Reopen confirms actual membership.
- Board/Table pointer and keyboard controls refresh every occurrence; rejection and unknown transport outcomes observe actual state without replay. Preserve EN/RU feedback and focus, including disappearance.
- Focused service/UI/IPC tests, typecheck/lint/docs, native runtime inspection at narrow/wide widths, independent Standards/Spec review, final full inventory, exact-SHA platform CI and integration. No new schema, dependency or copied bb module.
