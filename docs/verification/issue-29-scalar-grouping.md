# Issue 29 verification

Scenario contract: [plan](../plans/issue-29-scalar-grouping.md).
Exact-SHA CI, platform and integration acceptance: [GitHub #29](https://github.com/kornouhovas/workspace/issues/29).

## Local candidate evidence

Environment: macOS arm64, Node 22.21.1. Fixtures use temporary source folders and
real SQLite databases; no user project data is used.

- `npm run test:migrations`: 619 passed, one conditional platform skip. Initial
  failures were outdated expected view rows and fixture copy inventories after
  migration 0020. Focused upgrade reproduction failed before reconciliation;
  all 27 focused upgrades then passed. Existing identity/value/receipt/rollback
  assertions remain in place, with the new default column checked explicitly.
- Focused grouping service/UI, filter UI and production views IPC: 22 passed.
  Scenarios include exact scalar values, whitespace/zero/empty, typed order,
  manual new-value fallback, visibility distinct from filters, independent
  duplication, source siblings, Active/Archived, reopen, invalid ownership/keys,
  failed transactional save, corrupt settings and explicit repair.
- `npm run typecheck`, `npm run lint`, `npm run check:docs` and `git diff --check`
  passed after implementation and review repairs.
- `npm run smoke:views -- dev`: real Electron renderer/preload/service passed
  EN/RU Table/Board grouping, keyboard hide/show/collapse/expand and ungroup,
  saved order readback, existing lifecycle/duplication/sibling/restart/archived
  routes, unchanged fixture bytes, normal quit/backend exit and asserted cleanup.
  Screenshots cover widths 360, 1024 and 1440. Inspected changed screens; narrow
  Table keeps readable column widths with contained horizontal scrolling.
  Initial runtime detection exposed missing exact accessible select names; explicit
  labels repaired it. Visual inspection exposed narrow Table wrapping; its width
  and grid containment were repaired and the same original runtime route passed.
- Independent Standards review found no hard violations. Its projection-indexing
  suggestion was applied. Spec review found one semantic-config read/repair gap;
  source/type/key validation and regression resolved it. A delayed-property result
  regression prevents old group keys being assigned to a new property. Removing
  its projection-property guard makes that test fail; restoring it passes.
  Both follow-up reviews report no unresolved blocker.

Initial complete ordinary-parallel run: 2887 passed, 11 failed, 25 skipped.
One Ladle failure came from the temporary cross-worktree `node_modules` symlink
(Vite's filesystem allow list); placing the same dependencies inside this checkout
resolved the original focused check. Ten App failures came from the shared mock
routing the new grouping read into mutation-only callbacks. The mock now returns
the default ungrouped snapshot, just as it already supplies empty filters;
all 93 App/Ladle checks pass without weakening their existing assertions.

The renewed ordinary-parallel full inventory retained four Electron shutdown
timeouts: all three `property-editor-driver` cases and `runtime-electron-quit`
(2894 passed, 4 failed, 25 skipped). The unchanged original two-file focused run
passed all four tests. These synthetic fixtures do not load grouping code. The
same two files have retained parallel-run shutdown failures in issue 28. This
establishes a launch-condition difference, not a proven blocking actor or root
cause. No timeout, shutdown assertion, cleanup condition or product code was
relaxed. On candidate `0fb15b5`, the complete sequential inventory passed: **2898 passed, 25 conditional platform
skips, zero failures**, 2923 tests across 95 files. Every file selected by
`selectTestFiles(..., 'all')` ran with `--test-concurrency=1`; nothing was excluded.

## Long Text compatibility follow-up

While the first candidate's CI was running, inspection found an independent
10002-character group-key limit incompatible with valid long Text and JSON escape
expansion. The typed-service regression failed before removing that limit. It
now covers long Text, backslashes/newlines, exact membership, hiding, manual order
and reopen. Canonical JSON/type/ownership/uniqueness and collection bounds remain.
Both review axes confirmed the bounded repair. Rebuilt service/backend, all 30
affected grouping/filter service/UI/IPC checks, typecheck, lint and docs pass.
The first remote run was explicitly cancelled as superseded, not counted as
acceptance. The linked checkpoint records renewed complete local and exact-SHA
remote acceptance for this repair.

## CI coverage and limits

New real-service and UI files default to the existing platform test matrix. The
existing development and packaged `smoke:views` routes now also run the shared
scalar-grouping helper and retain its evidence/screenshots. No platform route,
assertion, deadline or ownership/cleanup gate is relaxed. Migration selection and
build/package resource inventories include 0020. No new bb module or dependency
is copied.

Local macOS evidence does not establish Windows or packaged acceptance. The linked
issue checkpoint owns actual run/attempt, tested/delivered SHA, required artifacts,
remaining acceptance gates and integration result. No release or main merge is
part of this issue.
