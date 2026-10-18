# Issue 33: Scalar and Single Select group dragging

Baseline: `2e448831` (`new-workspace`). Execution and acceptance: [GitHub #33](https://github.com/kornouhovas/workspace/issues/33).

## Contract

The owner confirmed that empty Text, Number and Date destinations clear the value, just like ordinary Single Select. Exact destinations preserve authored Text (including whitespace), numeric values and calendar dates; Select uses option identity. No buckets, filesystem changes, Name/category/MultiSelect assignment or new ordering semantics are included. The owner authorized publication for this issue in the current public repository.

A typed group-assignment command validates the view/workspace, expected grouping property, current source membership and destination against a fresh lifecycle projection. Stale or invalid drops fail without assigning a different value. Existing property commands own persistence, revision and source-sibling events. Assignment is distinct from view-owned row/group reordering. Both layouts expose a separate assignment drag handle and keyboard destination selector and Enter-activated clear button; existing cell editors remain available. No optimistic membership changes: requery the actual filtered/ordered projection after edits or failures. Unknown transport outcomes require observation and explicit retry, never automatic replay.

## Scenarios and agreed seams

The issue selects typed Workspace service with temporary real SQLite/filesystem fixtures, IPC and UI in both layouts as its verification seams; apply Matt Pocock TDD there.

- Each supported type: exact assignment, empty clearing, same-group no-op, reopen, siblings and unchanged folders.
- Fresh membership: filtered disappearance, manual row/group order preserved, stale grouping/source/destination, foreign IDs and malformed payload rejection.
- Service failure retains values and emits no committed success; transport failure refreshes actual state.
- Both languages/layouts: pointer assignment versus row reorder, keyboard alternative, pending/error/success and narrow-screen inspection; response ownership across view changes.
- Focused service/UI/IPC, typecheck, lint/docs, independent Standards/Spec review, final full suite, real Electron inspection, exact-SHA CI and authorized integration. No new migration or copied bb module.
