# workspace-jqv visual implementation checkpoint

Status: implementation exists; native after acceptance is **incomplete**. This is not a completed task or a visual acceptance claim. Source baseline: `97f44c0798d59049d88122054f0b524e8785ef45`, branch `codex/workspace-jqv-live-bb-visual`.

## Actual live reference and access

After the user's manual foreground action, bb 0.44.0 `/Applications/bb.app` became capturable as a straight native window. Reference captures in [bb](../bb/) include shell, thread actions, General settings, Appearance, theme picker and section submenu. Theme was Light, palette Default. Navigation, opening menus/settings and Escape were read-only; no bb content, files or preferences changed. The saved source af72bb81 and Tailwind 4/Radix documentation supplement these observations.

Later Computer Use failed independently of foreground: capture attempt timed out after 124.8s, a fresh inventory reset its REPL after timeout, and a fresh exact-path Electron getApp timed out after 120.4s with `Sky Computer Use request timed out`. Repeated retries stopped. This is a new bridge failure, not the original lock or Stage Manager condition.

## bb → Workspace before → correction → after

| Surface | Live bb/reference observation | Workspace before | Implemented correction | After status |
| --- | --- | --- | --- | --- |
| Native shell | Sidebar 320px, header 48px; toggle immediately after traffic lights, history at trailing edge | Toggle left 168px; history and toggle clustered | Toggle left 84px (28px hit area); expanded history aligned to sidebar trailing edge; collapsed history left 136px | Native routing and visual verification pending |
| Actions menus | Narrow thread actions; source min-width 176px, 12px text, 16px icons, 8px horizontal/5px vertical item padding | Workspace min-width 208px; view menus 224px | Workspace/view/shared menus min-width 176px, intrinsic Radix content width, viewport caps; preserve item typography and dismissal handlers | Native portal/submenu/focus gate pending |
| Settings | Centered bounded column, 16px section inset, open whitespace between sections | Full-width dense cards, 12px section inset, uneven field widths | Centered column capped at 768px; 24px outer inset, compact 16px horizontal inset; 16px section inset; 144px device selects; Properties uses same section rhythm | Native four size/theme combinations pending |
| Sidebar | Small icon Settings entry and quiet section label | Full-width labeled Settings row and stronger heading | 28px icon action retains accessible name; quieter section label and measured inset | Native hover/focus/selected states pending |
| Board | bb's shared surfaces distinguish content without nested recessed backgrounds; Workspace-specific Board retained | Gray inset column plus card frames | Remove recessed column surface, 36px headers, 12px card gap and lighter card hover outline | Workspace-specific adaptation; native review pending |
| Table | Shared neutral seam/hover treatment | Rounded outer table frame and tinted group bars | Flat top seam, neutral group headers with shared hover token | Native Table/group/menu gate pending |

The generic dropdown row tokens already matched bb and were retained. Board/Table are product-specific adaptations, not claimed pixel replicas of bb chat.

## Before evidence validity

[Dimension manifest](../before/dimensions.json) records every image. Valid dark Board, Table, expanded project and both settings captures exist at 1440×960 and 1024×720. Light 1440 Board/Table/global settings/customize captures have the expected dimensions. Workspace-menu dark captures and light expanded/menu/workspace-settings images have invalid or mismatched dimensions and are excluded from acceptance. Their filenames are historical capture labels, not proof of actual dimensions. No native after images exist yet. Shared `w-max` was removed after independent review identified its cascade overriding the raw Table property menu’s explicit 240px width; the existing 240px anchor clamp is retained.

## Runtime and verification

[Fixture runtime](../runtime.json), [isolated launcher](../launch.mjs): active Electron main/preload and JSON service adapters, dedicated temporary root/metadata; BrowserWindow fixture API at 127.0.0.1:9247 and CDP at 127.0.0.1:9246. Native sizes were explicitly set and verified at 1440×960 /1024×720. The currently launched renderer may still display the before build; reload the final build before any after capture. No user Workspace settings/data were used.

[Regression log](regression.txt): 21/21 pass. Existing structural expectations for old menu widths/table frame were updated to the authorized new geometry. [Typecheck](typecheck.txt), [renderer build](build-renderer.txt), and git diff --check completed successfully against the final source (renderer build reports the existing bundle-size warning). React/service/IPC/data/identity/security behavior was not modified. Foreign task-loop/.ralphex files remain untouched.

## Remaining acceptance

Capture the final native runtime at both sizes in Light/Dark: shell/sidebar, Board/Table, expanded project, Workspace/global settings and key menus. Check first outside-click dismissal without activating underlying actions, submenu pointer/focus/escape and 1024px portal bounds, long names, disabled/hover/selected state, and native sidebar restore near traffic lights. Reviewer independently inspects exact source and reference now; final acceptance and completion require that native gate. DESIGN_RULES remains unchanged.

## Existing native helper audit

`work/workspace-6fh/native-capture.mjs` calls the fixture `/front`, waits 700ms, then executes a compiled `capture-window` helper (up to five attempts), checking PNG pixel dimensions and CG window bounds. `capture-window.swift` enumerates windows by PID using `CGWindowListCopyWindowInfo` and captures via dynamically loaded `CGWindowListCreateImage`, then writes PNG through AppKit. The compiled executable is absent. `native-gate-diagnostic.md` is also absent. `capture-surfaces.mjs` additionally uses Playwright/CDP clicks, keys and renderer screenshots, so it cannot be reused as the current CUA-only UI workflow.

The supported variant is fixture BrowserWindow `/front` followed by CUA getApp/getScreenshot in the same call, with pixel dimension validation. It was already attempted during before capture, and the fresh selection itself now times out through the Computer Use bridge. Swift/CoreGraphics capture, AppleScript foreground and shell capture are alternative computer-interaction technologies; none were executed in this iteration. Their use requires explicit technology-specific authorization currently requested by the coordinator. A screenshot task alone is not treated as that authorization.

## Authorized native fallback continuation

The user explicitly authorized AppleScript foreground and native Mac capture. Existing Swift source was compiled to `/tmp/workspace-jqv-capture-window`; only fixture PID73610 was brought forward. Native capture succeeds with matching CG bounds and pixels. Fresh CUA exact-path getApp after foreground still timed out after 10s and reset its kernel, so UI input remains unavailable through CUA.

[Partial native report](../after/partial-native-report.json) supersedes the earlier no-after statement: four final-build Table/shell captures exist at 1440×960 and 1024×720, Light/Dark. [Capture script](../capture-native.mjs) sets only isolated fixture size/theme and reloads the current build; it performs no DOM UI clicks. All four images pass exact pixel/CG-bound checks. Visual inspection confirms the new toggle/history layout, quieter sidebar and Settings icon, and flat Table seam in both themes. Board, settings, expanded projects, menus and interaction acceptance remain pending explicit alternate input authorization or CUA recovery.

Partial final-build images: [Light 1440](../after/native-light-1440x960-table.png), [Light 1024](../after/native-light-1024x720-table.png), [Dark 1440](../after/native-dark-1440x960-table.png), [Dark 1024](../after/native-dark-1024x720-table.png). These prove the captured Table/shell state only. Permission for Playwright/CDP UI input in the named isolated test fixture is pending; waiting does not authorize clicks. Native OS pointer routing near traffic lights is not established by CDP geometry or screenshots.
