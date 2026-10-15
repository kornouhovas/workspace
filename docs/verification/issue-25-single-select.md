# Issue #25 verification

Scope and accepted choices: [implementation plan](../plans/issue-25-single-select.md).
Current candidate CI and delivery receipts: [GitHub #25](https://github.com/kornouhovas/workspace/issues/25).

## Observed local evidence

- Node 22.21.1 on macOS; temporary real SQLite databases and disposable source folders only.
- Initial public service regression failed on unsupported Single Select creation before implementation, then passed.
- Focused service, IPC and EN/RU UI scenarios passed: stable IDs, source ownership, nullable values, immutable type, exact payload validation, sibling notifications, no-op writes, rollback, workspace-local hiding and populated migration preservation.
- Typecheck, lint, documentation links and whitespace checks passed after review repair.
- `npm run test:migrations`: 340 tests, 339 passed, one platform skip, zero failures. The original run exposed the build fixture's stale last-migration index; the focused build check and complete migration command passed after correcting that expectation.
- Real Electron development smoke passed both languages with keyboard editing, invalid option draft, colors/order/hiding, retained usages, sibling changes, restart, clearing and unchanged fixture folders/files. 1024×720 and 1440×960 captures have no page overflow; narrow RU capture was visually inspected. Evidence is retained locally under `work/issue-25-select-runtime/`.

## Review

Standards review initially found one P2: retained option drafts lacked the existing localized same-field sibling-change notice. A real-service EN/RU regression failed before repair, then passed for Cancel exposing the current sibling name/color and explicit Save submitting retained fields. Original fields are now tracked separately from the draft. The independent Standards reviewer confirmed zero remaining findings on `102dfbf7`; the Spec reviewer reported zero findings on the implementation and repair.

## Final local suite

The first full run found one stale strict CI inventory expectation after adding the
new Single Select dev/package commands and artifact path: 2825 tests, 2801 passed,
one failed, 23 skipped. The original OS-comparison test independently reproduced it;
only those three expected entries changed. All 21 tests in the original file passed,
and the Standards reviewer confirmed the unchanged assertions and exact workflow match.

The renewed full `npm run test:all` on the completed source/test candidate passed:
2825 tests, 2802 passed, zero failures, 23 skips, 145.6 seconds. This reuses the final
`npm run build` output. Final development smoke passed EN/RU, including normal quit,
backend exit and owned-fixture cleanup. No production mutation, deadline or unrelated
acceptance assertion was relaxed to obtain these results.

## Final packaged macOS route

After the final UI repair, `npm run package:built`, `npm run check:artifact -- release`
and `npm run smoke:select -- release` passed. The package contains the migration,
backend route and applicable notices. Both EN/RU workflows, stable IDs, hiding/usages,
restart, keyboard, invalid drafts, source-sibling updates, 1024/1440 layouts and unchanged
folders/files passed with normal quit, backend exit and owned-fixture cleanup.
Evidence: local `work/issue-25-select-package-final/`.

## Pending platform gates

Exact-SHA three-platform CI and integration remain to be recorded in the GitHub checkpoint. Local macOS evidence does not establish Windows or release acceptance. No human acceptance was claimed. CI inherits existing common/platform and dev/package routes and adds `smoke:select` on each platform with retained `work/ci-select-*` evidence.
