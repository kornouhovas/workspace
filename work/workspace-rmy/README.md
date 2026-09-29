# workspace-rmy review evidence

Baseline:8d92888, branch codex/workspace-settings-yxk. Scope: common sidebar toggle geometry, shared Workspace row menu order, one-column workspace settings and affected UI contracts. No backend, IPC, storage or security changes. Unrelated work/task-loop and .ralphex preserved. Root integrated code, renderer and native review accepted; scoped local commit authorized.

## Cause and fix

Before real Electron bounds show sidebar button/SVG cy26 versus history SVG cy24 in the48px header. Absolute top12 combined with28px CSS size caused the2px offset. The button now uses shared bb-chrome-action and top10, keeping its reserved x168 and no-drag exclusion. All16 Board/expanded × open/collapsed × theme/size combinations report cy24 after. Hover/focus background remains visible (expanded-collapsed shots show grey hovered toggle).

The one shared dropdown renders Rename Workspace, Workspace settings, separator, Delete Workspace. Workspace settings CSS used auto-fit: at1440 Source and tree both y60, x332/x884. It now has minmax(0,1fr); source/tree/properties have equal x/width and strictly increasing y at both widths.

## Acceptance map

| Criterion | Evidence and result |
| --- | --- |
|1 Header Board/expanded, sidebar open/collapsed | before/after-{Light,Dark}-{1440,1024}-{board,expanded}-{open,collapsed}.png; after-results.json16 center checks pass. Clean macOS capture root-review/native-clean-expanded-collapsed.png shows native circles, toggle/history aligned without overlap; native-review.json reports native color bounding-box centers24.5–25px (antialias edges), SVG centers24px, at most1px difference. Root CUA real Show sidebar click restored rows and Hide sidebar label. |
|2 Context/ellipsis/keyboard, active/inactive, correct target | after-results.json46 total checks including6 entry checks,2 rename target comparisons and2 settings target checks; menu-inactive shots. Settled250ms between Escape and next entry avoids an overlay-close race in harness. |
|3 Wide stacked sections, long content, tree/status access | before/after settings-top/properties shots; after-results.json4 stack/4 no-overflow checks. Source A name140 chars, path over200, Workspace name200;4 statuses, project children expanded. scroll-results.json verifies final Status color combobox within viewport at both sizes/themes. |
|4 Full-size before/after themes/sizes and reproducibility |28 before +28 after matrix screenshots, native screenshot separate if root supplies it. Logical content1440×960 /1024×720 at device scale2, physical2880×1920 /2048×1440. Inputs copied from temporary clipboard to input/header-user.png and settings-user.png before edits. |
|5 Source isolation, roles/colors/preferences/tabs/Board/Table | preservation/electron-results.json28 checks and session-results.json5 checks pass: actual preload IPC with dialog outcomes injected for temporary sources; cancel/invalid/late picker, A/B isolation, role/color save, restart, recovery, expanded tabs and Table return. Theme changes exercised by matrix; language Node i18n checks passed. Actual native picker was verified in preceding workspace-yxk, not repeated for CSS correction. |
|6 Checks/contracts/commit | targeted.log30 tests pass; typecheck.log, build-renderer.log, diff-check.log pass. interface/ui-guidelines/settings flow updated. Root integrated code/visual review accepted; local commit authorized. |

## Reproduce

From checkout: npm run build:renderer, node work/workspace-rmy/verify.mjs after. Harness creates disposable folders and isolated WORKSPACE_DEV_DATA. Run preserve-verify.mjs then preserve-verify-session.mjs for source/role/color/session scenarios. verify-scroll.mjs captures Properties after scrolling the last Color control into view. before-results.json was captured on baseline before production edits. native-ready.mjs parks a separate real Electron runtime using the after fixture for root CUA review; native-ready.json holds its actual PID and CDP URL.

All scripts use temporary OS folders, never live project roots or production metadata. CDP screenshots/input are real Electron renderer verification; they do not prove native titlebar mouse routing. before-failure.png/after-failure.png are harness diagnosis images, not acceptance evidence. Native process31575 belongs to the prior task. Root CUA tested Show sidebar on temporary33735; its purple screen-sharing indicator obscured native circles, so those overlay screenshots are diagnostic. With explicit user authorization for AppleScript foreground and macOS screencapture, root raised fresh fixture PID34301/window21980 and captured clean circles without a CUA stream. Fresh1440×960 content, expanded Alpha/collapsed sidebar, Dark theme; Electron binary node_modules/electron/dist/Electron.app. Clean screenshot physical2880×1920 is native window evidence.
