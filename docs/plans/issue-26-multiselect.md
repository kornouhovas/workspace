# Issue #26: MultiSelect option sets

Origin: [GitHub #26](https://github.com/kornouhovas/workspace/issues/26).
Baseline: `19bfb28e` on `new-workspace`; dependency #25 is closed.
Executor: Matt Pocock implement/TDD. The owner explicitly authorized publishing #26 to the current public repository, its GitHub checkpoint, CI and successful integration into `new-workspace` on 2026-10-15. Current execution/CI/delivery receipts belong to [GitHub #26](https://github.com/kornouhovas/workspace/issues/26).

## Contract and seams

- Immutable source-owned `multi_select` definitions reuse ordinary option UUIDs, exact names, colors, order and workspace-local hiding. No option/property deletion, grouping or dragging is added.
- `workspace.setMultiSelectValue` replaces a project's complete option set. `[]` clears; duplicate, malformed, foreign-property/source IDs and extra fields are rejected atomically. Input order is irrelevant; returned memberships are ordered by stable option ID. Presentation follows option order.
- Empty has no membership rows. Same-set saves do not change revision or publish. A changed set commits atomically with the independent property revision and sibling event. Rename/reorder/hide never discard memberships.
- Hidden assigned options remain visible/removable in the editor; hidden unassigned options cannot be newly picked here. Typed assignment remains independent of presentation. Siblings share values and option settings, with independent hiding.
- Use the primary seam already confirmed in #7: typed Workspace service backed by temporary real SQLite and isolated folders. Add renderer/IPC checks for keyboard, localization and transport behavior the service cannot prove.
- Reuse current Table and option editor. React remains behind preload; no filesystem operations or duplicate project records. No additional bb code or dependency is copied.

## Scenarios and gates

- [x] Service: empty/add/remove/clear, no-op set order, stable IDs, rename/color/order/hide, sibling visibility, restart and unchanged project/files.
- [x] Rejections: duplicates/malformed/foreign IDs, wrong types, extra fields; failed replacement/clear/options roll back values/revision/events; unrelated source unchanged.
- [x] Upgrade populated pre-MultiSelect database with all existing typed values/options/visibility, ownership and immutable-type guards; update migration inventories.
- [x] EN/RU Table: create property/options, keyboard toggle/remove/clear/cancel, focus, empty/loading/pending/failure, retained draft and sibling change.
- [x] Built IPC validates new type/command and malformed payloads.
- [x] Actual Electron development and packaged macOS narrow/wide EN/RU workflow and restart; add required CI route.
- [x] Standards/spec review, repairs, type/lint/docs/migrations, final full local suite and local commit.
- [x] Explicit public publication permission for #26 (owner confirmation on 2026-10-15).
- [ ] Exact-SHA platform CI, integration acceptance and GitHub checkpoint (current status in GitHub #26).

## Verification

Run focused service/IPC/UI files regularly and typecheck between slices. Reconcile migration fixtures before `npm run test:migrations`. Review the complete candidate before one final full suite. Record observed local evidence in [verification](../verification/issue-26-multiselect.md). Required platform CI/integration gates stay open until actually observed.
