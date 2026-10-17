# Issue 28 verification

Scope and scenarios: [filter contract](../plans/issue-28-view-filters.md). Exact-SHA CI, acceptance and delivery are recorded in [GitHub #28](https://github.com/kornouhovas/workspace/issues/28).

## Local evidence

Node 22.21.1 on macOS arm64, disposable SQLite/source fixtures.

- Complete sequential inventory: **2883 passed, 25 platform skips, zero failures**, 2908 tests across 93 files. The inventory comes from `selectTestFiles(..., 'all')`, run with `node --import tsx --test --test-concurrency=1` and every selected file. No tests or original deadlines were removed.
- `npm run test:migrations`: **612 passed, 1 platform skip**. Migration 0019 retains populated properties, view identity/layout/selection and adds empty filters. Build/package inventories, historical-schema copying and preservation expectations include the new column explicitly.
- Real-SQLite filter service fixtures cover every ordinary type/operator, category identities and mode-change stale references, hidden options, invalid/foreign operands, failed-save rollback, corrupt configuration repair, Active/Archived separation, independent workspace/duplicate configuration and restart.
- Built IPC tests route filter requests through production entry validation and reject malformed shapes/operators/operands without partial updates.
- Focused App/filter/Ladle check: **100 passed**. The subsequent view-unavailable archive repair renewed the affected views/archive UI check: **21 passed**. Tests include EN/RU Table/Board search/conditions/clear, live membership, query error/retry, delayed initial reads, failed Clear, stale query rejection and retained editor focus. Initial view-load failure cannot expose unfiltered archived rows; Retry applies the saved filter.
- `typecheck`, `lint`, `check:docs` and `git diff --check` passed. Two-axis Matt Pocock review has no outstanding material Standards or Spec findings after repairs.

## Graphical route

The existing `npm run smoke:views -- dev` route now calls `runtime-view-filters.mjs` in both languages/layouts. It exercises Name search, a typed Text condition, value edits that remove/restore membership, empty guidance and keyboard submission through the actual renderer/preload/backend. Screenshots and horizontal-containment checks cover widths 360/1024/1440. The inherited route retains view lifecycle, source-sibling isolation, Active/Archived, restart, normal quit/backend exit and asserted fixture cleanup. The local development run passed, and captured screens were inspected. The final archive view-availability gate passed the renewed focused UI and graphical checks.

CI inherits this helper through the existing development and packaged views steps on macOS, Windows latest and Windows 2022. No CI route or coverage is removed. The linked issue checkpoint records the actual tested SHA, artifacts and platform outcomes; local pre-commit evidence alone does not establish Windows or packaged acceptance.

## Retained failures and repairs

The first migration run exposed historical fixtures expecting the old view columns. Expectations/copying were updated while retaining preservation, rollback and rejection assertions. An earlier full run found legacy UI mocks without the new empty-filter query route, plus a Ladle 403 caused by a temporary cross-checkout `node_modules` symlink. Mock projections now cover both list and Apply identities without changing workflow assertions; dependencies are local to the task checkout.

Those focused checks also reproduced editor focus loss from eagerly clearing result IDs during refresh. Accepted rows now remain mounted while a same-view request is pending; new membership and errors still update the projection. Deferred-read/Clear and stale-query races have red/green regressions. Archive metadata belongs to filtered rows, and an unavailable view cannot bypass filtering.

The final ordinary parallel `npm run test:all` run retained two original Electron shutdown timeouts in `property-editor-driver.test.mjs` and `runtime-electron-quit.test.mjs` (2881 passed, 2 failed, 25 skipped). The unchanged two-file focused run passed all four tests, and the full sequential inventory above passed. This demonstrates a launch-condition difference, not the historical blocking actor or root cause; no timeout, shutdown assertion or product code was relaxed. Exact-SHA remote platform coverage remains separately recorded in GitHub.

No copied bb module or new runtime dependency. No live user folders were used as fixtures.
