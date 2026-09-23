# Independent verification — Notion compact refinement, attempt 1

Observer `/root/compact_verifier`; checked 2026-09-23 05:37–05:43 UTC. Manifest SHA-256 `eff900ae9f03b2a93158c8b60f857c4bc3de6562d4e31ac2f49abd6b28930e7d` matches the supplied root. All 79 frozen paths matched before and after verification (`freeze-check-before.json`, `freeze-check-after.json`). Verifier wrote only in this directory.

| Check ID / role | Verdict | Independent evidence and boundary |
|---|---|---|
| `quality-boundaries` / quality | **pass** | Independent `npm test`: 204 pass, 0 fail; typecheck, renderer build and `git diff --check`: exit 0 (`npm-test.txt`, `typecheck.txt`, `build-renderer.txt`, `git-diff-check.txt`). Diff is 21 tracked renderer/UI/test/docs files plus the new focused test and design QA. No Electron preload/main, IPC, storage adapter, sidecar, dependency, project identity or security file changed. `workspaceViews.js` and `workspaceAppState.ts` retain empty status columns under filter/search as required; no status IDs or move rules changed (`source-audit.json`, `diff-names.txt`). |
| `shell-header-sidebar` / outcome | **inconclusive** | Renderer/DOM evidence passes the measurable subchecks: common 64px header and y=76 content anchor, 32px toggle/actions centered near y=32, fixed/truncating workspace title, 12px Settings inset, compact tab gaps. Collapsed toggle has a named 32×32 target and does not overlap renderer content. Required native open/collapsed frames and traffic-light relation are missing, so the full check cannot pass (`acceptance-row-audit.json` rows 1–5, 9–10). |
| `board-scroll-height-counts` / outcome | **pass** | Independent consistency audit over frozen probe JSON validates one shared vertical scroll: every column moves by exactly the Board scroll top, column internal scrollTop remains `[0,0,0]`; Board retains `overflow:auto` and horizontal overflow evidence; column heights 1216/544/208 follow 14/6/2 cards and filtered heights 124/90/90 are compact. Counts equal visible cards before/search/clear: 14/6/2 → 1/0/0 → 14/6/2. Source has a single `workspace-board-scroll` and no per-column vertical overflow (`functional-evidence-audit.json`, `source-audit.json`, `renderer-after-filtered-empty-columns-*.png`). |
| `project-detail-alignment` / outcome | **inconclusive** | Frozen DOM result records title, Properties, Hidden properties and File tree at 13px/500/20px and left x=281; file count is visible `1` with aria `1 элемент`. Source uses shared heading and inset classes. Required native expanded-project observation is absent (`cdp-probe-expanded-result.json`, `functional-evidence-audit.json`, acceptance row 8). |
| `compact-shared-surfaces` / outcome | **inconclusive** | Renderer PNGs at 1440×960 and 1024×720 show compact Board, Table, settings, detail, long tabs and empty/no-results states without clipped right actions; frozen focus probe reports a visible 1.5px solid outline. Image magic/dimensions and hashes are in `image-inventory.json`. The acceptance matrix asks for native screenshots across these surfaces; none exist after the change. |
| `behavior-persistence` / quality | **pass with replay limit** | Frozen raw probes record Board/Table, project open/many tabs, duplicate/restore/close, settings, keyboard focus, tab reload persistence and text-property reload persistence. Independent checks of those records satisfy 20/20 invariants (`functional-evidence-audit.json`); relevant automated tests pass. PID 13188 and CDP port 9236 were no longer live during verification, so the verifier could not replay interactions on the same isolated fixture. This verdict validates frozen functional evidence and code/tests, not a second live session. |
| `native-responsive-evidence` / outcome | **inconclusive** | No settled CoreGraphics full-window **after** pair exists at 1440×960 or 1024×720. Available PNGs are valid CDP renderer diagnostics and were not counted as native evidence. Executor recovery left only a 148×151 Stage Manager thumbnail; coordinator exact-path CUA failed with ScreenCaptureKit `-3811` before bind/raise. No macOS frame/traffic-light observation was returned (`native-capture-attempt-errors.md`, `root-cua-attempt-2026-09-23.md`). |
| `delivery` / delivery | **inconclusive before commit** | HEAD remains base `3ea0073ae0c1fca627d8ba4f2e28a0f46ea8b7b3`; product changes and the run are uncommitted (`head.txt`, `git-status.txt`). Frozen artifacts, renderer captures, evidence map and raw checks are present, and 87 filename references resolve (`artifact-reference-check.json`). A scoped local commit and post-commit delivery audit do not yet exist. |

## Twelve acceptance rows

Rows 2, 5–7, 9–10 and 12 pass from source/renderer/behavior evidence. Rows 1, 3–4, 8 and 11 remain inconclusive because their specified native observation is absent. Detailed row evidence is in `acceptance-row-audit.json`. No concrete product failure was observed in source, tests or renderer diagnostics.

## Visual observations

- Board screenshots show one common viewport, content-height columns, compact cards and counters. The third column is horizontally off-screen at 1024 and reachable through Board overflow.
- Expanded screenshots show a stable 64px shell header, common left inset and deliberately uniform small heading hierarchy. The result is materially denser than the supplied expanded reference, consistent with the user’s newer compact requirement.
- Long-name/many-tab capture visibly truncates the workspace name and keeps Restore/Close visible; the tab scrollbar appears beneath the active tab.
- The no-results screenshot has explicit centered copy. Filtered empty columns display compact dashed empty states.
- These observations apply to renderer pixels only. They do not establish native window composition, traffic-light clearance or full-window responsiveness.

## Raw material and limits

- `freeze-check-before.json`, `freeze-check-after.json`: 79/79 matching, manifest root hash above.
- `npm-test.txt`, `typecheck.txt`, `build-renderer.txt`, `git-diff-check.txt`: commands with UTC start/end, exit codes and complete captured output.
- `functional-evidence-audit.json`: 20/20 invariant checks over frozen raw CDP JSON; explicit artifact-only boundary.
- `image-inventory.json`: 19 PNG files with SHA-256, magic, byte count and dimensions.
- `source-audit.json`, `diff-names.txt`: audited product files and boundary statement.
- `artifact-reference-check.json`: 87 cited filenames/globs resolved; Markdown uses code references rather than clickable links.
- `process.txt` records the direct earlier `ps -p 13188` exit 1 and `curl` to port 9236 connection failure. This proves only that the previously identified process was unavailable during review.

A retry can close the inconclusive outcome checks only with settled full-window Electron after captures at both requested sizes, including open/collapsed sidebar, Board, expanded detail, long tabs and native frame/traffic lights. A later delivery attempt also needs a local commit and fresh audit.
