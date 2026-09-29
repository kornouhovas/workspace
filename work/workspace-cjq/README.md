# workspace-cjq — integrated review accepted

Branch: `codex/table-grouping-cjq`, baseline `1314a0b`. Shared checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`. Implementation and required verification complete; root integrated review accepted and scoped local commit completed. The resulting hash is reported in the handoff message. No push, merge or release.

## Result and boundaries

Table has one-level grouping by every existing property, including hidden columns. Customize → Group contains separate keyboard-accessible **Group by** and **Sort** controls, visibility, empty-group and collapse controls. Group sections reuse the existing table, columns and editors.

Domain/backend own keys, normalization, memberships and unique counts. Runtime continues through WorkspaceServiceClient/preload IPC and the existing transitional JSON adapters (ADR006); Go view documents and cascades preserve the additive internal contract. Storage, opaque IDs, folder roles, history, dependencies and Electron security remain within the existing boundaries. Locale is a transient `en`/`ru` projection parameter from the application; text comparison uses that explicit locale. Category defaults use catalog order; empty groups remain last. Queued functional mutations compose rapid changes against the latest draft and retain their captured view target.

## Acceptance map

| Criterion from saved task | Implementation and observed evidence |
| --- | --- |
| 1. All supported properties, values and flat fallback | `workspaceGrouping.js`, `workspaceViews.js`; domain tests and Electron all-types scenarios. Exact whitespace/case/newlines, number0, calendar dates, category IDs, empty and multi-select membership covered. |
| 2. Correct headers/colors/counts after filtering/editing | Domain counts use unique project IDs; renderer search helper updates groups/options/total together. Domain/filter tests; Electron search, zero-result hide-empty cases, number and multiline Text edits, category rename/color. |
| 3. Visibility, collapse, sorting/manual order, scrolling | Group panel/shared table; domain and queue regressions; Electron individual/all collapse, hide/restore, empty toggle, manual order, delayed double visibility and double move. Supplemental horizontal scroll and shared header/body alignment checks. |
| 4. View/workspace persistence and Board isolation | JSON restart, Go reopen, duplicate tests; Electron actual Duplicate, view and workspace A→B→A and restart. Board supplemental verifies original Status columns and drag restriction. Legacy views remain flat. |
| 5. Existing editing/layout/card/folder behavior | Existing cells remain shared; occurrence editor keys preserve project identity. Electron width330 survives regrouping, wrap-content and Text/Date/Number editors, card opening/return, hidden grouping column, delayed property save across view switch. Board folder-role restriction verified. |
| 6. Visual and keyboard matrix | 24 full renderer snapshots: both themes ×1440×960/1024×720 ×sidebar open/collapsed ×grouped/flat/Group panel, with long values. Natural mouse and keyboard inputs; Group by selection, Tab to Sort, sorting and section collapse. |
| 7. Tests, contracts, gates, integrated review, commit | Meaningful domain/queue/IPC/state/Go regressions; five affected contract docs. Gates below passed. Root reviewed domain/menu/reducer/API/Go and representative screenshots. Root integrated review accepted; scoped local commit authorized. |

## Completed checks

| Exact command | Result | Log |
| --- | --- | --- |
| `npm test` | 285 passed,0 failed | [npm-test.log](npm-test.log) |
| `npm run typecheck` | exit0 | [typecheck.log](typecheck.log) |
| `npm run build:renderer` | exit0; existing bundle-size warning | [build-renderer.log](build-renderer.log) |
| `go test ./...` | exit0 | [go-test.log](go-test.log) |
| `npm run build:sidecar` | exit0 | [build-sidecar.log](build-sidecar.log) |
| `git diff --check` | exit0 | [diff-check.log](diff-check.log) |

The initial full Node run exposed two additive-contract expectations; the default Board fixture and controlled dropdown-handler expectation were updated. The existing prohibition on global property-delete reload remains enforced: deletion refreshes the backend view projection. Final Node/typecheck/renderer checks were rerun after this final change. Go/sidecar checks cover the final Go changes. Log whitespace is normalized for repository diff checks; result content is unchanged. Red/green and first-run diagnostic logs are retained and are not presented as passing acceptance evidence.

## Runtime evidence and reproduction

- [electron-results.json](electron-results.json):55 passing actual Electron checks; [electron.log](electron.log).
- [interaction-results.json](interaction-results.json):12 passing keyboard/editor/layout/delayed-save checks; [interactions.log](interactions.log).
- [delete-ui-results.json](delete-ui-results.json):3 passing actual property-menu deletion/confirmation/notice checks after final projection-refresh implementation; [delete-ui.log](delete-ui.log). Final repeat used `verify-delete-ui.mjs text` because Select had already been deleted in the temporary profile.
- [board-results.json](board-results.json):3 passing Board isolation/return checks; [board.log](board.log).
- Visual files follow `{Light,Dark}-{1440,1024}-{open,collapsed}-{grouped,flat,menu}.png`. Examples: [small Dark menu](Dark-1024-open-menu.png), [large Light grouped](Light-1440-open-grouped.png), [small flat](Light-1024-collapsed-flat.png).
- [reference.png](reference.png) preserves the supplied screenshot; official reference: [Notion grouping documentation](https://www.notion.com/help/views-filters-and-sorts#groups). Task authority: [spec.json](spec.json).

Reproduce sequentially from the repository root after building the renderer:

```sh
npm run build:renderer
node work/workspace-cjq/verify.mjs
node work/workspace-cjq/verify-interactions.mjs
node work/workspace-cjq/verify-delete-ui.mjs
node work/workspace-cjq/verify-board.mjs
```

`verify.mjs` creates fresh disposable source folders and an isolated metadata/profile. Supplemental scripts reuse its `ready.json`. The scripts operate real Electron41 through Playwright CDP and preload IPC. Screenshots are full renderer captures at the recorded viewport dimensions; inputs are ordinary mouse/keyboard actions, without force-click acceptance. Native OS titlebar capture is not claimed. The native picker outcome for temporary workspaceB is injected into the isolated runtime; workspace switching and persistence execute the real application contract. No live user source or metadata is modified. Earlier `failure.png` and `interactions-failure.png` are diagnostic artifacts.

## Intended commit manifest

Exact paths are in [manifest.txt](manifest.txt): all task source, tests, five contract documents, and this task's evidence directory. Unrelated `work/task-loop/**` and `.ralphex/**` are excluded. No Beads changes are made by the executor.

Known limitation: grouping is one level with exact values, as approved. No interval buckets, subgrouping or new row-sort subsystem. Build success and CDP renderer verification are recorded separately from native OS behavior.
