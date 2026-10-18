# Issue 35: Filesystem group dragging

Baseline: `3c640d50` (`new-workspace`). Scope, acceptance and delivery checkpoints: [GitHub #35](https://github.com/kornouhovas/workspace/issues/35). Blockers #22 and #33 are closed. The owner authorized publication in the current public repository in this session.

## Contract and scenarios

The issue selects the typed Workspace service with disposable real SQLite/filesystem fixtures, IPC and Board/Table interactions as the test seams.

- Resolve Name/category destinations from the fresh owned view projection, never payload paths or values. Validate current origin membership, lifecycle and visibility. Empty Name/category destinations are unavailable. Archived placement stays fixed.
- Invoke the existing safe rename/category move with a backend-authored operation ID and current source revision. Preserve containment, native no-replace, reservations, identity, journal and explicit recovery behavior. Do not alter storage or native adapters.
- Return filesystem receipts alongside the property snapshot. Completed/unchanged receipts may report success; rejected and recoverable receipts must explain failure/recovery. Lost replies reload actual state and journal lists without replay.
- Keep filtered/ordered projections and sibling workspaces source-driven. Verify physical placement and metadata after reopening; reject stale, foreign, malformed and colliding destinations.
- Pointer, cancelled gesture and keyboard controls in EN/RU, no clear control for filesystem grouping, loading/error/recovery feedback and native narrow/wide layout inspection. Reuse existing UI primitives; no new bb module.
- Focused service/UI/IPC checks; inherited rename/category safety and recovery regression coverage; type/lint/docs/build; independent Standards/Spec review; final full suite; native views route inherited by all platform development/packaged CI; exact-SHA CI and integration.

Local observed results belong in [verification](../verification/issue-35-folder-drag.md). Pending remote/platform acceptance belongs to the issue checkpoint.
