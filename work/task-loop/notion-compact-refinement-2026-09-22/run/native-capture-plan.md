# Native CoreGraphics capture plan

## Provenance

- Electron executable: `/Users/aleksandersk/Documents/programming/Projects/project_folder/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`
- Main PID after relaunch with the local test inspector: `13188`
- Renderer PID: `13194`
- CDP endpoint: `127.0.0.1:9236`
- Main-process inspector endpoint: `127.0.0.1:9337`
- Source URL: `file:///Users/aleksandersk/Documents/programming/Projects/project_folder/dist/renderer/index.html`
- Fixture cwd/root: `/var/folders/9b/gg5177qd7_z9mq1g3rh0x4bc0000gn/T/workspace-compact-native-tdd9idew`
- Current CoreGraphics observation before root raise: window id6374, title `Workspace`, 148×151 at x=-271/y=519 (Stage Manager thumbnail; not acceptable as a final capture).

## Root-thread outcome

The coordinator attempted CUA `getApp` with the exact Electron.app path after inventory confirmed Electron was running. ScreenCaptureKit failed with `-3811` before application binding or raise; see `root-cua-attempt-2026-09-23.md`. Direct macOS CoreGraphics window-id selection is not supported by the published CUA `getApp` selector, so no schema-invalid id call was made. The capture sequence below remains the required resume path if a future environment can foreground the exact window.

## Executor capture sequence after raise

1. Clear the CDP device-metrics override so the renderer follows the real window.
2. Open Board, clear search, keep sidebar open; wait for 22 cards and `scrollTop=0`.
3. Run `capture-native-current-display.swift 13188 ... 1440 960`; record stdout, window id, bounds, PNG dimensions and magic.
4. Open `Active 01` tab; wait until `.workspace-project-detail-expanded` x equals the sidebar width; capture1440×960.
5. Repeat Board and expanded at1024×720.
6. At1024, collapse sidebar; capture after the toggle reads `Показать боковую панель`.
7. Reopen sidebar, search `Archive 01`; capture the1/0/0 compact empty-column state, then clear search.
8. Re-run the CoreGraphics window list, SHA-256, `file`, and pixel-dimension inventory. Any 148×151 thumbnail, mismatched PID/window id, missing frame/traffic lights or unsettled detail x-position invalidates the capture.

Planned output names:

- `native-after-board-window-1440x960.png`
- `native-after-expanded-window-1440x960.png`
- `native-after-board-window-1024x720.png`
- `native-after-expanded-window-1024x720.png`
- `native-after-collapsed-board-window-1024x720.png`
- `native-after-filtered-empty-columns-window-1440x960.png`

The renderer screenshots already in the run are diagnostics only and cannot replace these files.
