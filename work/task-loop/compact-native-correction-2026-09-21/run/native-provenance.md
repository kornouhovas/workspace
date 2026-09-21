# Electron provenance and capture boundary

Observed before implementation on 2026-09-21: the user's then-open project Electron was PID 56841 (Node wrapper PID 56840), launched at 22:40:49 local time from `/Users/aleksandersk/Documents/programming/Projects/project_folder`. The checkout was `codex/compact-redesign` at `195a6786a2be8adb08614223d17f9d5ef1de0910`. The built `dist/renderer/index.html` had mtime 22:40:48 and SHA-256 `2ceed45c307634ff93b1246a5e799eac23defca1044009f0206cd53aced25aca`. `electron/main.js` loads that `file://` file. The exact loaded URL in the then-open window is inferred from the executable/main source and timing; it was not directly read from that window.

At 23:16 local time PIDs 56840/56841 were no longer running. The only project Electron process was the isolated fixture below (PID 58040, Node wrapper PID 58031, launched at 22:52:00). Its working directory is recorded in [fixture-path.txt](fixture-path.txt). It loads the same project `electron/main.js` and real preload/IPC on separately created project folders. The current built `dist/renderer/index.html` SHA-256 is `84e7b73fa311d0604a971c038d9b7d4cec8085c3335ae30ca8dcdae69df2880a`; assets are `index-9MJNsmDH.css` and `index-WuoDXOZT.js`. CDP directly reported `file:///Users/aleksandersk/Documents/programming/Projects/project_folder/dist/renderer/index.html` at device scale 1. Captures use the CSS viewport and are verified as full-size PNGs.

```bash
cd /var/folders/9b/gg5177qd7_z9mq1g3rh0x4bc0000gn/T/workspace-compact-native-tdd9idew
/Users/aleksandersk/Documents/programming/Projects/project_folder/node_modules/.bin/electron --remote-debugging-port=9229 /Users/aleksandersk/Documents/programming/Projects/project_folder/electron/main.js
cd /Users/aleksandersk/Documents/programming/Projects/project_folder
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node work/task-loop/compact-native-correction-2026-09-21/run/native-cdp.mjs work/task-loop/compact-native-correction-2026-09-21/run/cdp-command.json
```

The first command uses the separate fixture directory in [fixture-path.txt](fixture-path.txt), not the repository. The second uses the checkout. The diagnostic helper connects to `127.0.0.1:9229` and saves the Electron **renderer surface**. It does not include the macOS title bar or traffic lights, and it is not a screenshot of the user's former PID 56841.

Native Computer Use for the exact `/Users/aleksandersk/Documents/programming/Projects/project_folder/node_modules/electron/dist/Electron.app` returned ScreenCaptureKit `SCStreamErrorDomain -3811` on repeated attempts, including after the final build ([raw error](native-cua-error.txt)). Selecting a generic app named “Electron” can bind a different worktree, so it was not treated as evidence. An independent verifier may retry the exact app path/window. Until a direct window screenshot succeeds, the live-window part of the visual outcome is **inconclusive**.
