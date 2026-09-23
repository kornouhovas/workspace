# Design QA — Notion compact refinement

## Source of truth

- Board reference: `work/task-loop/notion-compact-refinement-2026-09-22/run/references/board.png` (copied byte-for-byte from `/Users/aleksandersk/Downloads/download (1).png`).
- Expanded-project reference: `work/task-loop/notion-compact-refinement-2026-09-22/run/references/expanded.png` (copied byte-for-byte from `/Users/aleksandersk/Downloads/download (2).png`).
- The user's twelve current requirements override older density and top-row rules. Product behavior, data, status ordering and existing actions remain authoritative when an illustration differs from the running product.

## Viewports and data

- Renderer diagnostics: 1440×960 and 1024×720, device-scale emulation 1, from the isolated Electron renderer loaded from the current `dist/renderer/index.html` over local CDP port 9236.
- Test root: `/var/folders/9b/gg5177qd7_z9mq1g3rh0x4bc0000gn/T/workspace-compact-native-tdd9idew/projects`.
- Variable-height fixture: 14 Done, 6 In Progress and 2 Planned projects. Added projects exist only under that temporary fixture.
- The reference images are 1486×1059. Comparison sheets scale each source proportionally to 720 px width and do not crop or modify the UI content.

## Comparison inputs

- `work/task-loop/notion-compact-refinement-2026-09-22/run/comparison-board-reference-vs-renderer.png`
- `work/task-loop/notion-compact-refinement-2026-09-22/run/comparison-expanded-reference-vs-renderer.png`
- `work/task-loop/notion-compact-refinement-2026-09-22/run/renderer-after-variable-board-1440x960.png`
- `work/task-loop/notion-compact-refinement-2026-09-22/run/renderer-after-variable-board-1024x720.png`
- `work/task-loop/notion-compact-refinement-2026-09-22/run/renderer-after-final-expanded-1440x960.png`
- `work/task-loop/notion-compact-refinement-2026-09-22/run/renderer-after-final-expanded-1024x720.png`

Native CoreGraphics full-window after captures remain pending until the isolated Electron window is raised from Stage Manager by a root-thread UI action. Renderer captures are diagnostic evidence and are not labeled as native substitutes.

## Design comparison history

### Pass 1 — shell and Board structure

Observed that the previous implementation used a 320 px sidebar, a 96/113 px variable header, independent vertical scroll containers inside each column, full-height column surfaces, large 18 px headings and cards, and no visible per-column counts.

Changed the shared shell to a 256 px sidebar and stable 64 px header, moved the workspace name into the top row, aligned the sidebar toggle and right actions on the 32 px centerline, placed the collapsed toggle at x=80, and converted Board to one two-axis viewport with content-height columns and visible filtered counts.

### Pass 2 — shared compact scale and project detail

Reduced tabs, menus, sidebar controls, settings, table rows, Board cards and editor controls through their shared component classes. Normalized the expanded project title, Properties and Hidden properties to 13 px/500/20 px, aligned title/properties/file tree to the same 24 px content inset, and reduced the visible file-tree count to its number while retaining the descriptive accessible label.

### Pass 3 — responsive and state verification

At 1024×720 the Board retains horizontal scrolling and shows two full 360 px columns; the third remains reachable. At 1440×960 all three columns fit. A 400 px vertical scroll moved every column by the same amount while each column's own `scrollTop` remained zero. Long workspace text truncates in the fixed 160 px slot, project tabs scroll horizontally, and right actions stay visible. The expanded capture was repeated with a settled-panel x-position gate to exclude a transition frame.

## Deliberate differences from the illustrations

- Status order remains Done, In Progress, Planned because the current request preserves status rules. The illustration's Planned-first order is not applied.
- The workspace name is present in the top row because requirement 5 explicitly requires it.
- Board cards, controls and the expanded heading are smaller than the illustrations because the current request explicitly prioritizes a compact global scale and requires the project title, Properties and Hidden properties to use the same size and weight.
- Add View and Customize retain their real product actions and accessible names; no illustrative overflow action is added.
- Interface language follows the fixture's saved Russian setting. Project names and statuses remain the comparable English fixture values.

## Current result

Renderer and interaction evidence passes the implemented composition and behavior checks. Final design QA remains open only for the required settled CoreGraphics full-window captures with the macOS frame and traffic lights at 1440×960 and 1024×720.
