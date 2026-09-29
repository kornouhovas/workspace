# workspace-yxk implementation and acceptance evidence

Branch: `codex/workspace-settings-yxk`, based on `dfa52f7`. Shared checkout: `/Users/aleksandersk/Documents/programming/Projects/project_folder`. Unrelated task-loop and `.ralphex` edits remain intact. No push, merge, release or Beads state mutation by the worker.

## Implemented scope

- Workspace row menu includes Workspace settings alongside Rename/Delete. Keyboard actions trigger opens it, including an inactive Workspace.
- Workspace settings activates and identifies its target and shows its explicit source, role tree and existing system Status color controls.
- Bottom global Settings contains device language and appearance only.
- Picker, roles and Status colors use captured Workspace IDs. An outstanding A picker does not mark B as selecting or apply its late result to B. Source changes refresh Board/Table.
- Add Workspace works before a source is selected. The existing JSON adapter persists its opaque ID/default views and empty source locator; selecting a source later preserves those IDs. Rootless recovery clears outgoing project/tree/property data and remains usable through restart. Existing shared-root property semantics remain in effect.
- Late activation does not overwrite a newer global Settings/back/navigation choice. Long unbroken Workspace names remain inside the settings host.
- UI/flow/data-model/internal API docs describe the split and rootless creation. No new store, identity migration, sidecar route or Electron security change.

## Completed checks

| Check | Observed result | Evidence |
| --- | --- | --- |
| Node suite | 268 tests passed, 0 failed | `npm-test.log` |
| TypeScript | exit 0 | `typecheck.log` |
| Renderer production build | exit 0; existing bundle-size warning | `build-renderer.log` |
| Go tests | both packages passed (cached) | `go-test.log` |
| Sidecar build | exit 0 | `build-sidecar.log` |
| Diff whitespace | exit 0 | `diff-check.log` |
| Core Electron UI/behavior | 28 checks passed | `electron-results.json`, `electron-verification.log`, `verify.mjs` |
| Session/tab persistence | 5 checks passed | `session-results.json`, `verify-session.mjs` |
| Review regressions | 2 checks passed | `review-green.json`, `verify-review.mjs` |
| Native picker after-state | 3 checks passed after root CUA choose | `native-after.json`, `native-after-renderer.png` |
| Renderer regression subset | 29 tests passed | `renderer-regressions.log` |
| Documentation links | relative targets exist | `docs-links.log` |

The full cross-layer gate ran after the backend rootless change. Subsequent renderer review fixes reran relevant Node/typecheck/build/diff checks; unchanged Go/sidecar results were retained.

## Acceptance mapping and provenance

| Criterion | Status and evidence |
| --- | --- |
| A keyboard settings; inactive B context settings; coherent title/path/tree/Properties | Passed in real Electron via CDP-rendered controls, `electron-results.json` |
| Global Settings omits source/tree/Properties | Passed in real Electron; `global-{Light,Dark}-{1440,1024}.png` |
| Independent A/B roots, roles, Status colors; restart and projects | Passed in real Electron + actual preload IPC; source/role/color comparisons and project checks in `electron-results.json`; color persistence in `session-results.json` |
| Picker cancellation/invalid path/late A result while viewing B | Passed through real Electron IPC with injected `dialog.showOpenDialog` outcomes. No claim that injection itself exercises macOS picker selection |
| Rootless first creation, existing rootless restart, stable views/ID; missing root recovery | Passed; `first-rootless.png`, `missing-root-recovery.png`, Node rootless isolation regression |
| Board/Table return, preserved expanded project tab, restart | Passed; `session-results.json`, `session-table-with-tab.png` |
| Light/Dark, 1440×960 and 1024×720 settings and context menus | Renderer screenshots from real Electron, inspected by worker; `workspace-A-*`, `global-*`, `menu-B-*`. Settled menu frames replaced early animation captures |
| Long unbroken name on 1024 | Passed after root review fix; `review-green-unbroken-name.png` and bounds (`badge.right=999`, host.right=1011) |
| Late B activation after choosing global Settings | Red reproduced, green passed; `review-{red,green}-late-navigation.png/json` |
| Actual macOS native picker choose/cancel | Passed: worker observed native cancellation returning to enabled Select folder with unchanged path. After the user unlocked the Mac, root CUA opened the actual picker, entered the disposable directory and clicked Open. Read-only after-state confirms targeted B source (canonical `/private/var` locator), unchanged A, and B source/tree/Properties UI. See `root-review/native-before-workspace-B.png`, `root-review/native-picker-test-root.png`, their AX captures, and `native-after.json/png` |

`native-picker.png` is an OS window capture of the Electron shell while its native picker is outstanding; the separate picker sheet is not present in that window capture. The root’s unlocked CUA picker screenshots/AX records provide native before/path evidence. ScreenCaptureKit failed after the Open click (−3812, then rebind −3811), so the successful after-state image is read-only CDP from the same parked real Electron process. The worker’s earlier locked `native-results.json` failure remains diagnostic; it is superseded by the native choice and after-state evidence.

Readable log/AX text has whitespace normalized for the Git whitespace gate; any changed raw transcript is preserved byte-for-byte alongside it as `.raw.gz`.

Screenshots ending in `failure`, `diagnosis-*` and `review-red-*` are diagnosis artifacts, not acceptance screenshots. `diagnosis-inactive-B` records a harness count mistake (folder name and relative path both say Review); its image already shows coherent B data. `diagnosis-structure-test.log` records a stale assertion expecting the former unified surface. `review-red.json` initially compared the long-name badge with its already overflowing parent: the numeric bounds and screenshot demonstrate overflow beyond viewport1024, despite that initial predicate reporting true. The green predicate also checks against the viewport.

## Safe native fixture handoff

`native-ready.json` identifies the parked real Electron process, isolated metadata, B ID, and disposable `Native B selection` folder. `native-ready.mjs` opens B settings with the real unmodified native dialog implementation and then performs no further input. All fixture folders are under the OS temporary directory; no user's project roots or production metadata were used.

Root integrated review accepted the implementation and native choice evidence. The scoped implementation/evidence commit is authorized; Beads status and human acceptance belong to the root agent.
