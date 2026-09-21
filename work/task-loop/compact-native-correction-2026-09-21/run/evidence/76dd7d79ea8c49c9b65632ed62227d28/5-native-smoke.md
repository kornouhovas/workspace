# Isolated Electron interaction and quality smoke

Test surface: running Electron PID 58040, temporary fixture in [fixture-path.txt](fixture-path.txt), real preload/IPC, `file://dist/renderer/index.html`, 1024×720 viewport. These observations came from CDP pointer/key input and DOM state, not a browser fixture.

| Action | Observed result |
|---|---|
| Select Workspace App project tab | Expanded project dialog and Status/README.md content visible; full-size captures saved. |
| Restore side panel | Project tab removed from top strip, side panel remained open; close action stayed at right edge. |
| Close project details | After transition, dialog absent; Board selected, project card data unchanged. |
| Select Table, then Board | `aria-selected` moved to Table, table headers/row actions appeared; return moved selection to Board, cards appeared. |
| Add View icon | Tooltip title `Add View`, accessible label `Add Board or Table view`; menu offered New Board View and New Table View. |
| Customize icon | Tooltip title `Customize Columns`, accessible label `Customize Columns`; menu showed visible properties, filters and the saved 360px column width. |
| Settings | Settings surface opened with Back to workspace and folder-role controls for Done, In Progress and Planned. |
| Keyboard focus | CDP Tab and focus on Add View yielded `:focus-visible`, computed purple 2px outline after style recalc; [full-size focus capture](native-focus-1024x720.png) shows it. |

The focused action rectangle was 32×32px. The fixed action group remained visible at x924–1000 within 1024px. This smoke covers representative navigation and menus, not every project mutation or editor/persistence path; 200 Node tests passed, and the independent verifier still needs to assess relevant parity. No fixture files overlap the user's project folders.

Quality commands run from the repository checkout: `npm test` (200 pass, 0 fail), `npm run typecheck` (exit 0), `npm run build:renderer` (exit 0; only Vite chunk-size warning), `git diff --check` (exit 0). Raw outputs: [tests-final.txt](tests-final.txt), [typecheck-final.txt](typecheck-final.txt), [build-final.txt](build-final.txt), [diff-check-final.txt](diff-check-final.txt). A later whitespace-only source formatting change produced the same built asset names and the build command passed again.
