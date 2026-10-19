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

Two-axis review found and repaired the missing Backup smoke navigation and the
old initial window size. A shared WorkspaceSwitcher resolves the Standards duplication
heuristic; both reviewers accepted these repairs without further findings.

Completed-candidate full suite, inherited native smoke journeys, exact-SHA
CI on macOS/Windows and integration evidence are pending. GitHub owns those live
gates, human acceptance and delivered SHA. New ordinary CI coverage adds
`smoke:shell` to the existing three-platform matrix and uploads screenshots and
results with SHA/run/attempt identity. Existing tests and platform routes remain
registered. No migration, filesystem/domain command, permission or performance
assertion was removed.


## Local shutdown diagnosis

The inherited development runtime passed its primary workspace/discovery/property/
recovery journey, then failed a ten-second normal Electron shutdown in the separate
rename/recovery driver. The adapted Backup smoke reached actual restore and failed
its same normal-shutdown gate. Original failures and forced-cleanup evidence remain
retained; they do not pass native acceptance.

The unchanged `tests/runtime-electron-quit.test.mjs` reproduces the same failure
both in this checkout and at unchanged `new-workspace` baseline `8b35d16e`, using
only a minimal deferred-cleanup window (no app/service/SQLite/shell). A finite trace
observed prevented quit, completed cleanup, reentry, will-quit and the cleanup result,
followed by forced parent termination at the original deadline. This rules out the
new shell as a necessary trigger; it does not establish the underlying native cause.
No product timeout, quit behavior or acceptance assertion was changed to pass it.

## Reviewed candidate checks

The fresh native shell journey passed again after review repairs, now asserting
actual initial window size before any emulation. Both reviewers accepted the
repair delta. Focused real-service IPC and CI routing tests passed 80/80 after
updating two exact settings response fixtures and adding the new shell command to
the retained three-platform command inventory. Safety and platform assertions
remain unchanged. Retry also rejects initial-load responses from an earlier
backend lifetime.

The first completed-candidate `npm test` built successfully and ran 3144 tests:
3105 passed, 13 failed, 26 platform skips. Three failures were those now-repaired
settings/CI fixtures. The other ten were native normal-shutdown failures in
`property-editor-driver.test.mjs` and `runtime-electron-quit.test.mjs`; retained
finite receipts include app quit/Node exit followed by forced parent termination
at the unchanged ten-second gate. A separate raw Electron diagnostic did exit
normally; the underlying debugger/native teardown cause remains unproven.
These failures are not counted as passing local acceptance. Renewed full-suite
and exact-SHA CI results remain in the GitHub checkpoint until completed.

## First exact-SHA CI and launch-contract correction

The renewed local full suite on `719adbe` passed all 3118 applicable tests with
26 platform skips (3144 total). Earlier native quit failures did not recur; their
cause is still not claimed repaired. Exact-SHA Common/static CI and macOS14 DMG
installation/update/reopen also passed; the latter report and screenshots were
inspected.

Full desktop run `39298961435` failed the new launch-geometry assertion on macOS
latest and Windows2022 before ordinary platform tests. It demanded 1024x720 from
content, while #47 specifies a minimum window. Recorded contents were 1024x645 and
1008x689. The correction uses explicit default/minimum outer window dimensions,
records actual window/content/display/work-area geometry before resizing, and
keeps the two renderer-size journeys intact. Native ownership completion is now
recorded before independent geometry validation, so a geometry failure still
allows verified shutdown/cleanup. No off-screen-window override was added.

Focused route `checks: desktop-shell` owns renewed evidence for this exact failure;
full CI remains behind that gate. GitHub retains current results and delivered SHA.


## Scroll-return failure after the focused launch correction

Focused run `39300137710` passed all three platforms on `32b3a95`, with inspected
native reports: outer launch geometry, eight journeys, normal shutdown and cleanup.
The renewed full run `39300860777` then failed the first macOS shell return:
`scrollTop` changed from 1629 to 1633. Geometry, return focus and owned cleanup
passed. Windows shell journeys passed before entering the ordinary platform suite.
The secondary macOS collector validation had no original platform run to collect.
The full run is not accepted.

The unchanged native smoke passed locally; a disposable 30-return probe also found
no scroll drift. The smoke now records scroll/row geometry before focus, after
focus, while hidden and after return, retaining the exact equality assertion. This
is evidence collection for the next focused run, not a product fix or a passing
claim for the original failure. macOS installation run `39300868384` passed on the
same source SHA; its report and Russian screenshot were inspected.
