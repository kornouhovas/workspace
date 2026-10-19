# Issue 48 desktop shell verification

Requirements and acceptance: GitHub #48 / parent #47. Implementation baseline:
`8b35d16e`, including the owner-stopped #41 changes; this report does not accept #41.
The [scenario plan](../plans/issue-48-desktop-shell.md) records the inherited-test inventory.

## Observed local evidence

- Settings service: 8 tests passed, including real SQLite appearance default,
  independent language/theme persistence/reopen, validation and injected write failure.
- App and startup routing: 124 tests passed. Existing filesystem/recovery/draft and
  source-ownership assertions remain. App tests now enter General or Workspaces
  before operating moved controls. The synthetic browser exposes real happy-dom
  APIs needed by Radix and the browser hidden rule for keyboard traversal.
- `npm run typecheck`, `npm run lint`, `npm run check:docs`, `git diff --check`,
  the application build and `npm run build:ladle` passed.
- `npm run smoke:shell` passed on macOS arm64 using disposable real directories,
  SQLite and the actual Electron/preload/backend. Eight language/theme/size
  combinations cover 1024x720 and 1440x960, independently overflowing sidebar and
  project area, no document/horizontal overflow, keyboard settings entry/return,
  focus and scroll retention. It additionally covers source preview/cancel,
  sidebar switching with a saved active view, System media-query changes and
  fresh-launch workspace/preferences. Normal quit, backend exit and fixture
  cleanup passed. Screenshots and `result.json` are retained under
  `work/issue-48-desktop-shell` (ignored local artifacts).
- Inspected light/dark Table and settings screenshots. Existing project action,
  property and view controls retain their working UI during the incremental
  migration; this ticket does not claim later slices' final Table/editor design.

The native driver waits for the actual Radix arrow-key focus transition before
sending Enter. It does not retry the navigation or extend product deadlines.

## Remaining delivery gates

Review, completed-candidate full suite, inherited native smoke journeys, exact-SHA
CI on macOS/Windows and integration evidence are pending. GitHub owns those live
gates, human acceptance and delivered SHA. New ordinary CI coverage adds
`smoke:shell` to the existing three-platform matrix and uploads screenshots and
results with SHA/run/attempt identity. Existing tests and platform routes remain
registered. No migration, filesystem/domain command, permission or performance
assertion was removed.
