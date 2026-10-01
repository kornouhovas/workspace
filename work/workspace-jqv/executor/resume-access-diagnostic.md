# workspace-jqv resume: partial live access, 2026-10-01

This is an access/source checkpoint, not visual acceptance or implementation completion.

## Exact source and runtime

- Checkout `/Users/aleksandersk/Documents/programming/Projects/project_folder`, branch `codex/workspace-jqv-live-bb-visual`, HEAD `97f44c0798d59049d88122054f0b524e8785ef45`.
- Read-only `bd show workspace-jqv --json` reports `in_progress`; all five mandatory criteria still require completion.
- Process inspection again finds bb PID 9542 and its bridge/server/host children. No repository Electron/Vite runtime is running. Historical stale Workspace hypothesis remains unconfirmed.
- Source still uses preload transport, JSON view/property adapters; `electron/main.js` lines 88–90 retain context isolation, disabled Node integration and sandbox.
- No product/UI source, dependencies, bb data/preferences, or user project folders were changed. Foreign dirty paths remain intact.

## CUA observations and recovery

1. `cua.getState()` successfully inventories running bb (`dev.bb.desktop`) and native apps; browser surfaces contain no bb tab. Mac is no longer reported locked.
2. `cua.getApp('dev.bb.desktop')`, the exact `/Applications/bb.app` path, and a session reset followed by the same selection repeatedly fail with ScreenCaptureKit `-3811`, “Failed to start stream due to audio/video capture failure”.
3. A fresh Finder binding succeeds. Finder Go to Folder `/Applications/bb.app` exposes selected bb application image. Its documented `open` secondary action temporarily makes a fresh bb selection readable.
4. bb AX reports window “Объяснить расширяемость bb”, URL `127.0.0.1:38886/threads/thr_3wrhmda6av`. Visible surfaces include navigation rows, section headers, thread rows/actions, bottom Settings, pane header/actions, and composer. No menu/settings selection or bb content edit was performed.
5. `bb.getScreenshot()` returns a **light-theme** image of the live app in Stage Manager perspective, surrounded by a large white area. It is recorded in the CUA tool history; it is unsuitable for pixel measurements or reference acceptance and was not represented as a normal rectangular window capture.
6. Subsequent fresh AX/capture, safe Escape, window Raise, and fresh bb/Finder bindings again fail (`-3811` or `-3812`, “Failed due to an invalid parameter”). No documented Mac `launch_app` function exists in this runtime. Repeated identical retries stopped.

Safe recovery request sent through coordinator: manually bring bb to the foreground and leave its ordinary straight window visible outside the Stage Manager overview/transition. No system preference change is requested or performed. A response is pending; timeout is not confirmation.

## Source localization, not live measurements

The reference checkout remains `af72bb8167da292198bfa73b1c35ae3ac080bfca`. Its shared dropdown desktop item uses `px-2 py-[0.3125rem] text-xs`, a 16px glyph, `p-1` surface, rounded-md border and shadow-md. Workspace `src/components/ui/dropdown-menu.tsx` and `src/components/workspace/menu-styles.ts` already use those same generic choices. Another blind generic token replacement therefore has no source basis.

App-specific choices still need live comparison:

| Surface | Saved bb source | Current Workspace source | Required live check |
| --- | --- | --- | --- |
| Thread/workspace actions | `plugins/thread-list/app/rows/ThreadActionsMenu.tsx`: min-w-44, max-height min(24rem,100vh-2rem), scroll | `left-panel.tsx`: min-w-52 | Actual content width, groups, shortcut/icon alignment and long labels |
| Tab/view actions | bb content-specific menu overrides | `view-tabs.tsx`: min-w-56; fixed context surface | Actual tab menu geometry, focus/escape, collision bounds |
| Sidebar | navigation shared row text-sm, 8px indent, 28px primary action; selected/context surface classes | 28px rows, 320px configurable sidebar, independent navigation/search composition | Live spacing, section gaps, selected/hover tone, header and native control geometry |
| Customization/grouping | app-specific layouts, not shared dropdown defaults | 288px customize surface, p-0; mixed 28/32px custom rows and independent select portals | Menu row hierarchy, padding rhythm, portal/submenu interaction at 1024px |
| Settings/cards/table | Product-specific bb composition | Workspace source/roles/properties settings; Board/Table projections | Surface hierarchy, whitespace, field/button alignment and product-specific adaptations |

Potential implementation scope after stable reference: common menu classes and dropdown/select/popover primitives where a concrete discrepancy is observed, shell/sidebar spacing in `src/styles.css`, affected existing workspace surfaces, and UI policy/docs. No service/storage/identity/security change is indicated.

## Verification and continuation

No renderer build/typecheck/regression tests were run, because no implementation has begun. No new native Workspace fixtures or before/after screenshots exist. Old workspace-6fh evidence is historical and does not satisfy this iteration.

Continue with stable live bb capture/menu/settings inspection, isolated native Workspace before captures, a measured bb → before → correction → after matrix, implementation, relevant checks, four size/theme native combinations, independent acceptance, and a scoped local implementation commit. The older capture helper shells out to capture-window and is not an authorized CUA fallback under current instructions.

## Superseding continuation

The foreground request was answered and stable live bb captures were obtained. Implementation and isolated native before evidence now exist. The earlier pending/no-implementation statements above describe the initial access attempt only. See [current visual checkpoint](visual-checkpoint.md) for the new Computer Use bridge timeout, changes, actual checks and remaining native acceptance.
