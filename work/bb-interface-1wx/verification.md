# workspace-1wx verified code milestone — UI acceptance incomplete

Checkout `/Users/aleksandersk/.codex/worktrees/bb-stack-design/project_folder`, branch codex/bb-interface-1wx, baseab1671a. The code milestone is committed after the checks below. Beads untouched. The task is NOT complete and 1:1 visual acceptance is NOT established.

## Current implementation

Pinned bb0.44 shell/palette/Inter/Hugeicons/titlebar, sidebar/back-forward/appearance, right fixedNavigation + deduplicated launcher, contenttab close/reopen/batch/reorder/focus, UI-only nested split tree/content identities, collapse/adjacent focus, edge move/centre swap, pair resize, maximize/restore, validated session persistence. Existing service/preload/storage/security boundaries preserved; file leaf uses existing validated reveal service.

## Observed checks

- Targeted tab/pane/tree Node tests:22 tests passed after tree integration (workspaceProjectTabs, workspacePaneLayout, workspaceSplitTree). Includes nested resize, move/swap, close collapse/neighbour and sole-content fallback, malformed duplicate identities, persistence focus/maximize, blank dedup/history.
- Typecheck passed after tree integration (typecheck.log).
- Renderer build passed after tree integration (renderer-build.log), existing >500kB chunk warning.
- Full npm test before tree:248 tests,244pass,4fail. Failures are old static Compact contracts: dashboardStructure requires removed workspace-current-name titlebar identity; notionCompactLayout requires64px header/256px sidebar rather than livebb48/320, assumes exact inline JSX formatting for restore icon, and requires40px tablist/32px pills/menus rather than livebb28px. These static assertions are superseded; preserve product behavior/boundary assertions and remove obsolete visual expectations with provenance.
- Full npm test after tree integration:254/254passed (node-tests.log); Go tests passed (go-tests.log); sidecar build passed (sidecar-build.log).
- git diff --check passed. Intended diff reviewed: presentation modules/docs/dependencies, Electron native geometry, regression tests and disposable evidence only; no service/storage/preload security changes. Formatting in App/detail contributes to the larger diff.

## Runtime evidence / limitation

Disposable service fixture `fixture.mjs` creates Alpha/Beta/Gamma with actual Workspace service. Initial real Electron1440x960 light Board was loaded and AX/screenshot observed. Later CUA native calls failed ScreenCaptureKit-3811 after28–42seconds in both worker and root; no claim of completed Electron workflow or4comparison screenshots. User permission for alternative Playwright/Electron UI automation is pending; no bypass performed. Browser reference works through root CUA. Production transport not modified for testing.

## Required remaining

Real fixture UI Board/Table/detail/settings/search/filter/property/folder/tabs/split workflows,4fullsize light/dark1440x960/1024x720 Workspace captures and equivalent-shell metrics/comparisons. Unverified criteria must remain explicit. Parent integration/review of the verified code milestone may proceed; task completion must wait for remaining acceptance evidence.

## Milestone handoff

Primary Close pane, Workspace/Settings reachability after closing/replacing primary, focused-only Escape and CmdW owning-pane actions are wired. Fixed rightNavigation CmdW does nothing; primary split CmdW closes its own pane; detail CmdW closes its own tab. Closing a pane focuses the surviving leaf in DOM. Pointer header drag follows7px source engagement and restores maximization after drop/cancel. These UI paths are code-reviewed and covered at pure transition level; complete runtime acceptance remains unverified.

Browser fixture38901: root CUA AX observed service-backed Board→Alpha detail→Open in split with Workspace+Alpha and fixedNavigation right. Later action dispatch timed out; consoleerrors empty, fixture scanHTTP200 in0.00316sec and Node0%CPU. Both own browser screenshots have a720x480 UI quadrant inside1440x960 and are unusable for pixel comparison. No native capture fallback bypass performed.

Remaining criteria: actual Electron4theme/size captures and equivalent-shell metrics; native tab hover/middle/context/overflow/reorder/reopen and repeated persistence; tree edge/centre drag, pairresize/keyboard/focus/maximize/restore/close including maximized drag runtime; full fixture Board/Table/settings/search/filter/property/folder flows. Source evidence and Node passes do not complete those criteria.
