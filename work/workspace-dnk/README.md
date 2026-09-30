# workspace-dnk — review accepted

Checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`.
Branch: `codex/table-group-drag-dnk`; baseline `dcabd126ce54d6f2019f2c31f2ec74e529bf7386`.
Root's integrated review accepted the implementation and evidence; scoped local commit authorized. No push/merge/release.

Implemented left group handles with pointer threshold, captured pointer, Escape/outside cancellation, preview, insertion marker, edge autoscroll and Arrow Up/Down keyboard alternative under all sorts. Only a changed position saves Manual with the complete displayed order, including hidden groups. Empty is fixed last. Domain helpers and the existing functional queue handle ordering; intermediate own refreshes cannot discard newer saved drafts.

Grouped Table has separate tbody sections, a heading, repeated headers for expanded groups with rows, and 20px gaps. One colgroup shares column order/width and existing editing/card/wrap behavior. Header menus, rename and add-property controls belong to the selected occurrence; column drag measures only that header. Flat Table retains its single sticky header. Existing storage/IPC/security/Board/folder rules are retained.

## Criteria and observed results

| Criterion | Evidence | Result |
| --- | --- | --- |
| 1: actual drag from all sorts, auto Manual; click/no-op/Escape/outside do not save | `drag-results.json`, `verify-drag.mjs`; `pointer-preview-insertion.png` | Real Playwright mouse/keyboard in Electron; all four sorts passed; cancellation cases recorded zero grouping updateView calls |
| 2: hidden/collapsed/hide-empty preserved; empty last/nonmovable | `green-domain.log`, `drag-results.json`; `end-marker-before-empty.png` | Hidden groups retained in full manual order; independent settings retained; marker appears before fixed empty |
| 3: functional composition, delayed saves, views/workspaces, restart | `green-domain.log`, `after/electron-results.json`, `drag-results.json` | Target isolation and rapid changes covered by domain queue tests and actual delayed UI writes/view switch; actual workspace A/B/A and restart retain independent settings; red→green intermediate own-refresh regression |
| 4: sections/shared grid/editors/card/Board/flat | `after/electron-results.json`, `drag-results.json`, `sections-results.json`; `later-header-shared-horizontal.png`, `sections-edited-card-return.png` | Later-header resize/reorder and horizontal scroll align every repeated header/body; one menu/rename/add popover; rename saved once; Text/Number editing, Date opening, wrap, card return, collapse/empty/flat and Board checked |
| 5: meaningful regression/keyboard/ordinary inputs | `red-order.log`, `red-intermediate-refresh.log`, `green-domain.log`, `drag-results.json` | Initial retained manual order and intermediate refresh reproduced failing behavior; 17 domain/queue tests pass; handles work with arrows and real mouse |
| 6: before/after matrix, long names, many groups/scroll | `before/*-grouped.png`, `before/*-menu.png`, `after/*-grouped.png`, `after/*-menu.png`, `many-*.png`, `many-groups-edge-scroll-preview.png` | 1440×960 and 1024×720 × Light/Dark × open/collapsed sidebar; complete renderer viewport captures, 18 additional long category names and actual edge scroll |
| 7: contracts/checks/review/commit | docs changes; logs below; `manifest.json`, `intended-files.txt` | Checks completed; root accepted the integrated review and authorized the scoped local commit |

Empty sections here mean groups with zero matching rows. No value/No status with rows has a repeated column header when expanded.

## Completed commands

- `node --test test/workspaceGrouping.test.js` before order implementation: 11 passed, 1 intended failure (`red-order.log`).
- `node --test test/workspaceGroupingMutations.test.js` before refresh-race fix: 3 passed, 1 intended failure (`red-intermediate-refresh.log`).
- `node --test test/workspaceGrouping.test.js test/workspaceGroupingMutations.test.js`: 17/17 passed (`green-domain.log`).
- `npm test`: 289/289 passed (`npm-test.log`). Existing structural assertions were adapted to repeated tbody attributes and occurrence-controlled header interactions while preserving border/dismissal guarantees.
- `npm run typecheck`: exit 0 (`typecheck.log`).
- `npm run build:renderer`: exit 0 (`build-renderer.log`); existing bundle-size advisory remains.
- `node work/workspace-dnk/baseline.mjs`: 21/21 checks before renderer rebuild (`before/electron-results.json`, `baseline.log`).
- `node work/workspace-dnk/verify.mjs`: 51/51 checks (`after/electron-results.json`, `verify.log`).
- `node work/workspace-dnk/verify-drag.mjs`: 26/26 checks on final renderer (`drag-results.json`, `drag.log`).
- `node work/workspace-dnk/verify-sections.mjs`: 26/26 checks on final renderer (`sections-results.json`, `sections.log`).
- `git diff --check`: exit 0 (`diff-check.log`). Untracked evidence whitespace check is recorded in `evidence-whitespace.log`; root checks the staged diff before commit.

Log whitespace is normalized for the staged whitespace gate; command output content is retained.

## Reproduction and boundaries

`baseline.mjs` must run with the baseline renderer build to recreate before images. `verify.mjs` creates its own temporary metadata/source fixture and writes `after-fixture.json`; then run `verify-drag.mjs` and `verify-sections.mjs` against that isolated fixture. Setup and persisted assertions use Workspace IPC; pointer and keyboard interactions use ordinary Playwright input in a real Electron 41 window. `reference.png` is the user-provided saved visual reference.

Fixtures live under the system temporary directory; their JSON files here contain only fixture locators/IDs, no live user workspace data. Each script closes only its own Electron process. Production profile/runtime was preserved. Captures show the whole Electron renderer viewport; native OS titlebar and picker are not claimed as verified. Date editor opening was checked; no date-value change is claimed.

Only renderer/domain order/queue code and UI documentation changed. No Go, sidecar contract, backend transport, migration or storage implementation changed; Go/sidecar gates do not apply. The manifest lists all intended source/test/docs/evidence files and SHA-256 digests; its own path is listed but self-digest is omitted. Unrelated `work/task-loop/**` and `.ralphex/**` are excluded.
