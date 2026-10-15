# Issue #25: Ordinary Single Select

Origin: [GitHub #25](https://github.com/kornouhovas/workspace/issues/25).
Baseline: `e74d7188` on `new-workspace`. Dependency #12 is closed.
Executor: Matt Pocock implement/TDD. Candidate CI, ownership and integration receipts remain in the GitHub checkpoint.

## Accepted contract

- `single_select` is an immutable source-owned ordinary property type. Definitions use existing create/rename commands and the independent property revision.
- Options have stable UUIDs, exact nonblank names, a fixed named color palette and source-owned order. Option creation, rename/color and complete duplicate-free reorder never modify project folders.
- Assignment accepts one option belonging to the same property/source, or null to clear. Other types, foreign workspace/project/property/option IDs and extra payload fields fail without mutation or notifications. Empty is an absent value, never an empty option ID.
- The owner confirmed workspace-local hide/show. Hidden options are omitted from new picker assignments here; assigned hidden values remain visible, editable and clearable. Sibling workspaces retain independent visibility. Names/colors/order and project assignments remain shared. Hiding never removes values. A typed value assignment is independent of picker presentation.
- Visibility survives restart; removing a workspace removes its presentation only. Existing source data and IDs remain. No option/property deletion, MultiSelect, general views or filesystem command is added.
- The owner explicitly authorized publishing this issue to the current public repository, overriding the default private-source publication restriction for #25 only.

## Scenarios and completion

- [x] Real-SQLite typed service: create/options/assign/clear, source siblings and restart.
- [x] Rename/color/reorder/hide/show retain option IDs and usages; sibling visibility remains independent.
- [x] Invalid ownership, malformed saves, immutable type and no-op notification behavior.
- [x] Transaction failure preserves values/options/visibility, revision and notifications.
- [x] Populated pre-Select upgrade preserves Text/Number/Date, identities and type/ownership guards; all dependent migration fixtures updated.
- [x] EN/RU keyboard Table workflow with real service, empty values, validation and sibling reloads.
- [x] Built backend IPC accepts every command and rejects invalid payloads without mutation.
- [x] Real Electron dev/package UI at 1024/1440, EN/RU keyboard, invalid drafts, presentation, restart, source-sibling updates and unchanged folders.
- [x] Two-axis review and repair; final type/lint/docs/migration checks.
- [x] Full local suite on the completed candidate (2825 tests, zero failures, 23 skips).
- [ ] Candidate commit, required platform CI/artifacts and authorized integration.

## Boundaries and checks

Extend the current typed service/preload route and Table editor. SQLite migration 0016 preserves all existing typed value rows before rebuilding the immutable definition constraint; new tables enforce option ownership and workspace-local visibility. React does not access Node or SQLite. Existing UI primitives are reused; no additional bb code/dependency was copied.

Run focused `single-select-*` service/IPC/UI files; `npm run test:migrations`; typecheck, lint and docs links; full local suite once after review repairs. `npm run smoke:select -- dev|release` adds actual-platform acceptance to the existing three-OS CI matrix. Existing acceptance routes are inherited unchanged. See the [verification report](../verification/issue-25-single-select.md) for observed results.
