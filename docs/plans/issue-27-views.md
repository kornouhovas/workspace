# Issue 27: Independent Table and Board views

Base: `b1dff556` (`new-workspace`). Tracker: [GitHub #27](https://github.com/kornouhovas/workspace/issues/27).

## Contract and scope

A workspace owns an ordered nonempty view collection and remembers its selected view even while another workspace is active. A view has an exact nonblank authored name and a Table or Board layout. Layout is the presentation setting in this slice; grouping, filtering and detailed layout controls are separate tickets. Duplication copies the layout into an independent view in one transaction. Create/duplicate select the new view; deletion selects the first remaining view only when deleting the selection. Reordering requires the exact collection once each. Removing the workspace removes its selections and views, retaining source data. Existing workspaces migrate without changing identities or active selection.

Both layouts use the existing typed property cells and source projections, including category and all five ordinary property types. The Board is an ungrouped collection of project cards. No filesystem mutation is introduced by view commands. EN/RU lifecycle controls use native keyboard controls, pending/error states and focus restoration. No bb module is copied.

## Scenarios and verification seams

The issue already specifies the public seams: typed service with real disposable SQLite/filesystem fixtures, IPC and focused keyboard UI interaction.

- Default/migrated Table, create/activate/rename/layout/reorder/delete with at least one retained.
- Duplicate then change layout/name without changing original; rejected/failed duplication exposes no partial view.
- Wrong workspace IDs, malformed payloads and incomplete/duplicate reorder reject without writes/events.
- Restart and workspace switching preserve each selection, order and collection; workspace removal handles Board-only fallback.
- Shared source properties appear in both layouts and sibling workspaces without sharing presentation.
- Active and Archived projects follow the selected layout, including switching layouts while Archived is visible.
- Both languages, keyboard create/edit/cancel/switch/reorder/duplicate/delete, load/save errors, narrow layout and empty state.
- Populated migration preservation, migration inventory, artifact fixtures and reopen.
- Focused files and regular typecheck; migration suite, review, then full suite on completed candidate; lint/docs/build and visual runtime inspection.

CI/publication and integration evidence belongs in the GitHub checkpoint. The owner explicitly authorized publication of this issue in the current public repository.
