# Issue 32: Board columns and card presentation

Base: `9458c3e8` (`new-workspace`). Tracker and CI/integration checkpoint: [GitHub #32](https://github.com/kornouhovas/workspace/issues/32).

## Contract

Board reuses view-owned grouping order, visibility, collapse and hide-empty controls. Column widths belong to a view and a grouping property plus canonical group key; option/category IDs survive renames, while exact scalar values retain their exact-value identity. New groups use 384 CSS pixels; explicit widths are 180–800 pixels. Hidden, empty, collapsed and temporarily absent groups retain their saved widths. New groups follow the existing grouping default/manual append rules. Reordering columns never assigns a project value or moves a folder.

Card property visibility and content wrapping belong to the view, independently of source-owned definitions/values and Table settings. Name stays visible for identity/recovery. New properties are visible in definition order. Wrapping defaults on, preserving existing content; off clips display text, without clipping editors or changing stored values. Duplicate copies Board and grouping settings independently; source siblings remain independent. Layout switching preserves inactive presentation settings. Invalid saved configuration requires an explicit reset, never silent normalization.

The owner authorized publication of this issue in the current public repository. No new bb modules or dependencies are copied.

## Scenarios and seams

The originating issue selects typed Workspace service with real temporary SQLite/filesystem fixtures, IPC and keyboard UI as verification seams. Use TDD at these established seams.

- Save/reopen widths, field visibility and wrapping; option/category rename, exact scalar keys, newly appearing and empty groups, grouping switches and filtered projections.
- Group ordering/visibility/collapse remains separate from project assignment; no project/file/property mutation.
- Duplicate divergence, sibling and Table independence; invalid/foreign references, bounded widths, uniqueness and exact payloads reject without writes/events.
- Populated migration retains identities, selection, filters/grouping/values; malformed storage and injected failure require explicit repair.
- EN/RU keyboard resize/visibility/wrap, pending/error/retry/reset, late-response ownership, renderer refresh and narrow horizontal scrolling.
- Focused service/UI/IPC, migration fixtures, regular typecheck, lint/docs, two-axis independent review, final full suite, real Electron inspection and exact-SHA CI/integration.
