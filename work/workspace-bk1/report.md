# workspace-bk1 executor report

Implementation independently accepted in scope: [review](reviewer/review.md). The coordinator authorized the scoped local commit after frozen-file verification. No Beads changes or push by the executor. Native screenshots and detailed program logs remain local evidence; reproducible scripts and acceptance reports are included in the commit.

## Root cause and changes

Before readonly Electron measurement at 1440×960: html bounding width1429, body clientWidth1418 and shell right1418, while document/body scrollHeight960 equals viewport960. Both html and body declared `scrollbar-gutter: stable`, reserving an unused11px gutter each. The native before images show the resulting22px outer strip. This is not Board/Table content overflow.

`src/styles.css` removes those two reservations. Scrollbar styling and Board/Table overflow containers are retained. After runtime measurement shell right1440 equals viewport1440, with root scrollHeight960 and no document overflow.

`src/components/workspace/project-detail-panel.tsx` applies the same content inset in preview/expanded/split hosts: top12px, bottom24px, horizontal24–32px based on actual panel container width. Properties/Hidden properties/File tree share this inset and16px section gaps. Rows remain borderless. One responsive96–160px label grid is shared by visible, hidden and Add property rows; long action labels wrap. Host project identity stays in the existing title tab per Interface, with its existing full-name tooltip/accessibility label; there is no duplicated project heading.

`test/dashboardStructure.test.js` updates only the affected inset composition expectation (the old top/bottom Tailwind classes moved into CSS). No unrelated assertion was changed.

## Verification

- Profile Node tests:34/34 pass (`regression.txt`): notionCompactLayout, workspacePaneLayout, workspaceSplitTree, workspaceBoardLayout, workspaceProjectSession, workspaceProjectTabs.
- Typecheck passed (`typecheck.txt`).
- Renderer build passed (`build-renderer.txt`); existing bundle-size warning.
- Runtime failing regression before: `before/layout-gate-red.txt`, shell1418 vs1440.
- Runtime green after: `after/layout-gate-green.txt` and `after/project-layout-gate-green.txt`, root edge1440 and project padding24/24/12, Properties top12.
- Full npm test:291/292 pass (`npm-test.txt`). The one failing `renderer composes the workspace product shell` is pre-existing and was observed before editing (`before/node-baseline.txt`): ViewFilter old regex `h-6 min-w-6 justify-center rounded-full px-2` fails. After the scoped assertion update, `dashboard-structure.txt` retains the same failure. Full test suite is not reported green.
- `git diff --check` passed (`diff-check.txt`).

Native after screenshots cover Table, Board and side preview in Light/Dark1440×960 and1024×720. `after/manifest.json` contains12 matrix shots plus one supplementary Table capture. PNG dimensions and BrowserWindow bounds validated; helper selects the titled `Workspace` window of the exact fixture PID, and logs CoreGraphics bounds. Project images were refreshed after the final action-wrap change. Board/Table screenshots preceding that last change remain applicable because it affects only the Add property label in Project Detail.

Native before: dark Table1440/1024 and dark project1440 in `before/manifest.json`. `before/native-dark-1440x960-board.png` was captured from the initial own Electron PID4942 with matching CG/pixels1440×960. Initial theme labels were corrected after inspection: system appearance was dark. Invalid tilted Stage Manager capture is quarantined in `invalid/` and excluded.

At1024 the responsive preview is352px and at1440 it is560px. Native project screenshots show readable wrapped Notes, a hidden long property name with full accessible label,42 file rows with long names truncating inside the pane, and the full Add property action split across lines. Required scrollbars remain visible. Runtime project content has clientWidth548/scrollWidth548 at560px and Board shows clientWidth517/scrollWidth780, demonstrating available horizontal overflow without clipping the document.

## Runtime acceptance and capture incident

Fresh CUA initially selected a foreign Electron by shared bundle ID; no input was sent to it. A copied Electron with fixture-specific bundle identifier `com.workspace.bk1.fixture` solved selection. Native Stage Manager miniatures were rejected. After one Raise recovery failed, the user manually foregrounded Project Alpha, enabling valid captures.

CUA button input successfully switched Board/Table and opened Project Alpha. A Table downward scroll was attempted via CUA, but the first measurement selector omitted the Table's actual scroll host, so this does not prove the scroll position changed. The supplementary `table-scrolled` filename must not be interpreted as interaction acceptance.

Later CUA coordinate drag, splitter click/keyboard attempt and fresh AX observation failed with ScreenCaptureKit -3812 invalid parameter; a preceding screenshot failed -3811. The executor stopped input. After explicit user authorization for CDP/Playwright input only in PID5166/CDP9266, the independent reviewer completed these gates without changing the frozen source.

[Runtime acceptance](reviewer/runtime-gates.json) verifies keyboard preview resize280→1120, ArrowRight296 and pointer drag296→496; content fits at both preview bounds, shared insets/grid remain aligned, and the full Add property action wraps at280. Project wheel reached bottom608=1520−912. Board reached horizontal199=780−581 and vertical2533=3406−873. [Table scrolling](reviewer/table-scroll.json) confirms nested horizontal left183=668−485 and outer vertical top431.5. Expanded Alpha and Ctrl+pointer split creation worked; split keyboard resize50→70→50 worked. [Supported splits](reviewer/split-supported.json) confirm project widths351.5px at1024 and559.5px at1440 after hiding Navigation, with matching grids, complete actions and no horizontal content overflow. Renderer split images supplement the12 native preview images; no native split screenshot claim.

An extreme tiny split remains outside this fix: retaining Navigation600 and a70% split can compress the project host below280px (155px/31px), producing horizontal overflow. The baseline already cannot fit those widths. Working split259px/351px/559px and preview280–1120 were verified; this task adds no split-width constraint. The full program suite remains291/292 with the pre-existing ViewFilter regex failure.

## Reproduction and handoff

The accepted runtime used PID5166, bundle `/tmp/Workspace-bk1.app`, CDP `http://127.0.0.1:9266`, fixture API `http://127.0.0.1:9267`; `runtime.json` records its dedicated temp source/metadata. The executor stops this own runtime and removes its temporary app/helper after the scoped commit. The foreign PID87347 and ports9256/9257 were not changed.

Executor capture state: light1440×960, Board plus Project Alpha preview; reviewer then exercised resize/scroll/split. Use CUA `/tmp/Workspace-bk1.app`; verify URL is this checkout's file://dist renderer and Projects are test Alpha/Beta/stress, not the user's live projects. CUA was the original input path; reviewer runtime scripts use the later explicitly authorized fixture-scoped CDP input. Fixture API `/size?width=1440&height=960` and `/front` affect only this runtime. Readonly measurements: `node work/workspace-bk1/measure.mjs <output.json>`; edge/inset gate: `node work/workspace-bk1/layout-gate.mjs`.

To reproduce from scratch: copy the installed Electron app into `/tmp/Workspace-bk1.app`, set its bundle ID/name as above, compile `capture-window.swift` into `/tmp/workspace-bk1-capture-window`, build renderer, run `node work/workspace-bk1/launch.mjs`, then run `stress-fixture.mjs` and `seed-values.mjs` for disposable stress data. Scripts configure only isolated fixtures. The launcher/API are long-running and must not be started while their own ports are in use. Existing fixture restart can use `WORKSPACE_BK1_REUSE=1` after stopping only its own recorded process and launcher.

Native capture: `node work/workspace-bk1/capture.mjs after light 1440 960 project configure`. The optional `configure` argument sets only isolated theme and reloads; omit it after CUA actions to preserve the current UI state. Capture requires a genuinely foreground full-size native window, not a miniature. Capture/measurement scripts contain no UI input.

Product source diff: `task.diff`. Changed tracked files only: `src/styles.css`, `src/components/workspace/project-detail-panel.tsx`, `test/dashboardStructure.test.js`. Task artifacts are under `work/workspace-bk1/`. Preserve all foreign dirty dropdown/menu-dismissal, workspace-ld0, jqv/6fh, task-loop and .ralphex files. Coordinator granted post-review scoped local commit authorization. Product/test frozen files remain exactly the independently reviewed diff.
