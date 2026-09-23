# Fresh baseline capture attempt errors

Observed 2026-09-22 on the isolated Electron process (PID 7951):

1. `swift run/capture-native-equal-viewport.swift 7951 ... 1440 960` returned `Could not enter temporary capture display mode`.
2. `swift run/capture-native-current-display.swift 7951 ... 1440 960` returned `Could not size Electron window` because AX window mutation was denied.
3. `cua.getApp("Electron")` from executor `/root/compact_executor` was rejected before capture: `MCP server elicitations can only be requested by the root thread`.
4. CDP renderer diagnostics on port 9236 succeeded and confirmed the current file URL/state, but renderer screenshots are not accepted as native full-window evidence.

The run therefore reuses prior verified native before images whose product tree is byte-equivalent, and keeps the fresh native after capture as an unresolved required step.

## Independent recovery attempt — 2026-09-23

The isolated app was relaunched as Electron PID13188 with renderer PID13194, CDP9236 and a local main-process Node inspector on9337. This enabled direct, reversible BrowserWindow operations without modifying product code:

1. `BrowserWindow.show()`, `setBounds({x:36,y:22,width:1440,height:960})`, `moveTop()` and `focus()` reported a logical1440×875 window, clamped to the current visible display height, but CoreGraphics still exposed only window6374 at148×151/x=-271/y=519.
2. `app.focus({steal:true})` also left `BrowserWindow.isFocused()` false and the CoreGraphics thumbnail unchanged.
3. A temporary `setVisibleOnAllWorkspaces(true)` plus `setAlwaysOnTop(true, 'screen-saver')` changed the thumbnail layer to1001 but did not restore its full pixels. Both flags were immediately restored; `main-restore-window-flags-result.json` records `alwaysOnTop:false`.
4. AX diagnostics show the app-level object in `AXWindows`, with no window actions/position/size/minimized attributes (`-25205`/`-25206`); `AXRaise` cannot operate on it.

Raw results: `main-show-window-1440-result.json`, `main-steal-focus-window-result.json`, `main-force-visible-window-result.json`, `main-restore-window-flags-result.json`, `raise-native-window-pid10313.txt`, and `native-window-list-pid13188-after-inspector.txt`.

These materially different system and main-process routes are exhausted. The remaining safe path is a root-thread CUA selection/raise of the exact Electron.app window. Until that occurs, native after evidence remains incomplete; renderer screenshots are not relabeled as native.

## Root-thread CUA attempt — 2026-09-23

The coordinator's distinct root-thread attempt is recorded in `root-cua-attempt-2026-09-23.md`. CUA inventory saw the Electron process, but exact-path `getApp()` failed with ScreenCaptureKit `-3811` before app binding or raise. The published macOS API has no supported CoreGraphics-window-id selector, so no schema-invalid window-id call was made. With this route exhausted, full-window native after evidence remains required and unresolved.
