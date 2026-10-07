# Project close and preview-only right host verification

Date: 2026-10-08. Implementation baseline: `596325d`. Branch: `codex/project-close-to-view`.

## Authorized behavior

The user confirmed removal of standalone right Navigation while retaining project previews and split panes. Closing an active fullscreen project returns to the selected saved view even when other project tabs remain. See [ADR 010](../../docs/adr/010-project-close-and-preview-only-right-host.md).

## Evidence

- The two initial regressions failed before implementation: active tab close chose another project, and closeSplit retained right visibility.
- Current checkout: 60 targeted Node checks passed (tabs, layout, keyboard, project session, preview races, split tree, localization and existing rename chrome). Typecheck and renderer build passed. Existing documentation checks: 2/2 passed; 17 local links in affected docs checked with no missing paths/fragments. Staged whitespace check passed.
- A clean export of the staged source was checked independently: 59 targeted Node checks passed, typecheck and renderer build passed. This export excludes pre-existing uncommitted product/rename changes. The existing rename chrome check runs only in the current checkout because its module/test are unrelated incoming work.
- [Current-checkout desktop report](report.json) and [staged-source desktop report](committed-source-report.json) each record 11 completed assertions/groups, zero renderer errors and actual BrowserWindow sizes of 1440×960 and 1024×720. The same [runner](verify-desktop.mjs) creates temporary project folders, JSON metadata and Electron userData, never using production folders or preferences.
- Screenshots `closed-board-*` and `restored-preview-*` capture the current checkout's real Electron renderer after X and Restore at both sizes. They are renderer captures, not OS screenshots or full accessibility/platform acceptance.
- The desktop checks cover single/multiple project X, selected Table return, other tabs retained, Restore/partial Close, legacy maximized Navigation/launcher state, removed opener shortcuts, actual Electron restart, reopened project Cmd+W and preservation of split panes during independent preview open/close. Existing preload security flags remain unchanged.

## Boundaries and reproduction

`node work/project-close-to-view/verify-desktop.mjs` requires the existing installed Electron/dependencies and a built renderer (`npm run build:renderer`). It retains temporary fixture paths in each report. Closed-tab reopen history remains transient across application restarts.

Only this task's changes are staged. Prior tracked edits, untracked rename work and external historical-document deletions remain in the original checkout, outside this commit. No backend, IPC, project files, durable metadata or CSS changes belong to this task. Full Node/Go/release gates are not rerun for this renderer-only fix. The existing renderer chunk-size build warning remains.
