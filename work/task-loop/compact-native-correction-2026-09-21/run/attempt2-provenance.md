# Attempt 2: actual Electron window provenance

The former user window PID 56841 exited before this correction. The final evidence is from a separate **running native Electron** instance, PID 58040 (wrapper PID 58031), launched with `electron/main.js` from this checkout on `codex/compact-redesign`. Its executable is `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`; CDP reports the loaded page as `file:///Users/aleksandersk/Documents/programming/Projects/project_folder/dist/renderer/index.html`. The renderer build under capture has `index.html` SHA-256 `355f36577a5fefb28064c3b81ab98f96edf6af060b29c145db31f73ab9d7e469`, assets `index-BHj5H0UO.js` and `index-DWHRAd75.css`. Branch base before local commit: `195a6786a2be8adb08614223d17f9d5ef1de0910`.

The instance uses [separate test data](fixture-path.txt), six projects, one README.md per project and real Electron preload/IPC. The saved fixture Board width is 360px and status colors are yellow/blue/green. A temporary extra `Select` property created during earlier interaction testing was deleted **only from this fixture through the app UI** before the final matched pair. The user's folders were not changed.

Full-window captures use [capture-native-equal-viewport.swift](capture-native-equal-viewport.swift). It switches the main display temporarily to 2048×1280 at 1x, sets the exact Electron AX window size, activates PID 58040, selects CoreGraphics layer-0 window ID 2792 by PID/title, invokes `CGWindowListCreateImage`, rejects mismatched bounds or PNG dimensions and restores the original 1512×982 display mode. This includes the macOS window frame, rounded corners and traffic lights. It is distinct from the [CDP renderer helper](native-cdp.mjs), which uses `Page.captureScreenshot` and has no window frame. ScreenCaptureKit through CUA returned `SCStreamErrorDomain -3811` in attempt 1; the CoreGraphics path succeeded.

Reproduction from the repository root, after launching the isolated Electron fixture and selecting a settled Board/project state:

```bash
swift work/task-loop/compact-native-correction-2026-09-21/run/capture-native-equal-viewport.swift 58040 work/task-loop/compact-native-correction-2026-09-21/run/native-attempt2-final-board-window-1486x1059.png 1486 1059
swift work/task-loop/compact-native-correction-2026-09-21/run/capture-native-equal-viewport.swift 58040 work/task-loop/compact-native-correction-2026-09-21/run/native-attempt2-final-expanded-window-1486x1059.png 1486 1059
```

The fixture can be started as follows; its directory is the one recorded in [fixture-path.txt](fixture-path.txt):

```bash
cd /var/folders/9b/gg5177qd7_z9mq1g3rh0x4bc0000gn/T/workspace-compact-native-tdd9idew
/Users/aleksandersk/Documents/programming/Projects/project_folder/node_modules/.bin/electron --remote-debugging-port=9229 /Users/aleksandersk/Documents/programming/Projects/project_folder/electron/main.js
```

Capture file mtimes in UTC and observed full-window dimensions:

| File | UTC | PNG |
|---|---|---|
| [Board 1486](native-attempt2-final-board-window-1486x1059.png) | 2026-09-21 20:56:19 | 1486×1059 |
| [Expanded 1486](native-attempt2-final-expanded-window-1486x1059.png) | 2026-09-21 20:59:34 | 1486×1059 |
| [Board 1440](native-attempt2-final-board-window-1440x960.png) | 2026-09-21 21:00:29 | 1440×960 |
| [Expanded 1440](native-attempt2-final-expanded-window-1440x960.png) | 2026-09-21 21:00:46 | 1440×960 |
| [Board 1024](native-attempt2-final-board-window-1024x720.png) | 2026-09-21 21:00:32 | 1024×720 |
| [Expanded 1024](native-attempt2-final-expanded-window-1024x720.png) | 2026-09-21 21:00:12 | 1024×720 |
| [Keyboard focus 1024](native-attempt2-final-focus-window-1024x720.png) | 2026-09-21 21:01:22 | 1024×720 |

For all seven final captures the command reported `pid=58040 window=2792`, exact requested bounds and PNG dimensions, followed by `restored_display=0 mode=1512x982`. `file` independently identified each final raster as a PNG of the stated size. A transient earlier 1022×718 intermediate is not part of the final set.

The paired [renderer Board](native-attempt2-board-renderer-1486x1059.png) and [renderer expanded](native-attempt2-expanded-renderer-1486x1059.png) are secondary diagnostics from that same Electron process. They do **not** substitute for the full-window images. The exact former user window is not available for direct observation, so that particular process remains an explicit provenance limit.
