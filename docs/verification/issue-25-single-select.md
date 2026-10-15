# Issue #25 verification

Scope and accepted choices: [implementation plan](../plans/issue-25-single-select.md).
Current candidate CI and delivery receipts: [GitHub #25](https://github.com/kornouhovas/workspace/issues/25).

## Observed local evidence

- Node 22.21.1 on macOS; temporary real SQLite databases and disposable source folders only.
- Initial public service regression failed on unsupported Single Select creation before implementation, then passed.
- Focused service, IPC and EN/RU UI scenarios passed: stable IDs, source ownership, nullable values, immutable type, exact payload validation, sibling notifications, no-op writes, rollback, workspace-local hiding and populated migration preservation.
- Typecheck and lint passed during implementation.
- Real Electron development smoke passed both languages with keyboard editing, invalid option draft, colors/order/hiding, retained usages, sibling changes, restart, clearing and unchanged fixture folders/files. 1024×720 and 1440×960 captures have no page overflow; narrow RU capture was visually inspected. Evidence is retained locally under `work/issue-25-select-runtime/`.

## Pending final gates

Two-axis review, final migration/full suite, packaged local smoke and exact-SHA three-platform CI/integration remain to be recorded. Local macOS evidence does not establish Windows or release acceptance. No human acceptance was claimed. CI inherits existing common/platform and dev/package routes and adds `smoke:select` on each platform with retained `work/ci-select-*` evidence.
