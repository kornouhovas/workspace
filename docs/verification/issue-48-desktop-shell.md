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


Focused diagnostic run `39302080068` reproduced the same macOS 1629→1633 shift.
Fonts were loaded and scroll height/row heights were identical before/after;
focus alone did not move the workspace. Hiding with `display:none` collapsed its
geometry and evicted viewport rows while settings was open. The shell now keeps
that geometry beneath the settings grid layer, with `visibility:hidden`,
`aria-hidden` and `inert` excluding visual, accessibility and keyboard interaction.
The native scenario additionally asserts hidden-state geometry and inertness,
while retaining exact return-position equality. Local native smoke and targeted
EN/RU keyboard/focus/reorder tests passed. Both review axes accepted the delta;
remote original-smoke verification remains required.

Windows 2022's original platform suite passed, then its original creation/recovery
Ladle route failed `creation-blocked-english` wrapping. Expanded existing failure
receipts identify unwrapped nodes on every story, without changing that assertion.
The focused shell route now also builds Ladle and replays the original Windows
2022 creation-layout command after its build prerequisite, retaining its report.


The strengthened local smoke completed its eight geometry/scroll/keyboard journeys
but then hit the previously recorded native ten-second shutdown failure at its
restart boundary. That run is retained as failed; it does not satisfy shutdown
acceptance. Targeted keyboard tests passed 3/3 after the HappyDOM fixture applied
the production visibility rule, and CI route tests passed 43/43. Typecheck, lint
and documentation checks passed. Remote verification must still establish both
original shell shutdown and the Windows creation-layout failure receipt.


## Native scroll repair and final-workspace focus

On `8b94693`, the original remote macOS native shell passed all eight journeys,
exact scroll return, normal shutdown and cleanup. Its renderer regression exposed
a final-workspace deletion focus transition; the original DOM-node assertion then
exhausted the test process while formatting the mismatch. Compact identity
assertions preserve that requirement without dumping the React DOM. The shell
notifies App after the empty workspace is shown and idle; App owns focusing its
creation field. The test awaits that actual asynchronous transition.

All 96 renderer tests passed locally after the focus repair; the targeted removal/
EN/RU return group passed 3/3, and routing tests passed 43/43. The rebuilt native
shell passed its original journeys, normal shutdown/restart/cleanup and the added
real final-workspace removal/focus scenario. Both review axes accepted the repair.

The Windows 2022 focused receipt identified the wrapping failure precisely: its
204-character authored name fit a 1412-pixel line under the new 13px typography,
without overflow. The same story failed on Windows latest in the original full
run. Presentation fixtures now use 238/239-character names (250/245 UTF-8 bytes),
retaining realizable basenames and forcing the long-name stimulus at wide sizes.
No wrapping, containment, native shutdown or data-preservation assertion was
removed. Both affected Windows runners now replay original creation/recovery
layouts in the focused route. Renewed exact-SHA remote acceptance remains pending.


Final-candidate local checks: application and Ladle builds passed; the repaired
creation-blocked story passed all three layouts and its wide screenshot was
inspected. Typecheck, lint, links and diff checks passed. The completed candidate's
full `test:all` ran 3145 tests: 3118 passed, 26 platform skips, one failed. The
unchanged Russian Number property-editor fixture completed keyboard activation,
then hit the previously recorded native ten-second shutdown failure; its finite
receipt observed before-quit/will-quit/quit/Node-exit before parent termination.
The original failure is retained in `/tmp/issue48-final-candidate-all.log`; it is
not counted as a successful full local run. No shutdown deadline or behavior was
changed. Exact-SHA remote full acceptance is still required after focused repair
verification. No repeated broad local run is scheduled for this unchanged native
failure.


## Property-label presentation fixture correction

Focused run `39304907771` passed all three OSes on `41623b2`; exact-SHA reports
were inspected for eight shell journeys, final removal focus, shutdown and cleanup,
plus 108 creation/recovery screenshots on each Windows runner. Both installer
routes passed on that source (`39305766114`, `39306105998`); reports confirm data
preservation and cleanup.

Full run `39305756420` passed common and macOS platform tests, then the original
category-layout route failed `category-move-collision-english`. Its inspected
receipt identifies only the authored property label: 202 characters fit its
1440-pixel span, without overflow, at the new density. The existing shared long
property/category-label fixtures now use 26 repeated segments, strengthening the
wrapping stimulus across their dependent scenes. Property labels are not
filesystem basenames and their public service validation accepts these nonblank
values. No production code, style, assertion, deadline or route is changed.
Both review axes accepted this fixture-only delta. The complete original local
category-layout route passed 150 EN/RU screenshots, wrapping/containment,
interaction and normal native shutdown. New remote evidence uses the existing
`view-fixtures` route, which runs the matching original category command and
related UI regressions. Windows jobs from the failed full run are retained rather
than canceled. The unchanged production source retains `41623b2` installer
acceptance; renewed full desktop acceptance remains pending after focused success.


## Controlled recovery-preview fixture phases

Focused category run `39308184550` passed all three OSes on `edf7d1a`; downloaded
reports/provenance confirm all 150 original layouts, interactions and shutdown.
Full run `39308952674` then found one macOS renderer fixture race in the existing
Refresh/conflicting-category scenario: the expected disabled radio had disappeared
because the preview correctly showed `recoveryStale`. A tight selected-test probe
reproduced the same failure locally in under one second after allowing 250ms for
native debounce. Finite events recorded `workspace.sourceObserved` revisions
1, 2 and 3; the last state invalidated the open preview. Debug output and the
diagnostic delay were removed.

The fixture now owns observer callbacks/scheduling with actual filesystem probes,
real source scans, SQLite and service reconciliation. It first asserts the original
identity/revision/metadata and disabled candidate/confirmation; it then delivers a
later watcher failure explicitly and asserts that its observation invalidates the
preview, removes the candidate and keeps confirmation disabled. Escape and exact
authored Text assertions remain. Both review axes accepted this controlled-observer
integration seam. It does not establish native watcher timing or background-worker
transport acceptance; their separate original checks remain unchanged. No product
code, production shutdown, timeout or safety assertion changes in this repair.
The selected EN/RU test passed; renewed renderer-file and exact-SHA focused/full
CI evidence remains in GitHub.


All 96 renderer tests passed locally after the controlled-clock repair. Typecheck,
lint, documentation links and diff checks passed. The repair contains only that
test and this report; production source is still identical to installer-tested
`41623b2`.

## Original views lifecycle: visibility and saved-filter repair

Focused run `39311071301` passed all three OSes on `215f2f6`; downloaded
provenance, renderer results, original shell journeys and native cleanup were
inspected. Full run `39308952674` subsequently completed with both Windows
platform suites passing, then the original development Table/Board lifecycle
failed in `runtime-folder-group-assignment.mjs`: a lazy field detached after
viewport resizing. The retained Windows 2022 evidence and both failed job logs
identify the same driver boundary.

A narrow original-helper reproduction starting at 360 pixels reproduced the
missing lazy field. The driver now waits for the committed C/Target identity and
uses the existing owned-project visibility helper after movement, resize and
reload, before interacting with its lazily mounted field. It never retries a
mutation. The narrow EN/RU Table/Board probe passed all four cases, shutdown and
cleanup; original identity, filesystem, metadata and containment assertions remain.

Replaying the full original views consumer then exposed a product defect in
metadata removal: the service had rewritten saved filter operands from Old to
Next, while ViewFilters retained Old and displayed an unavailable reference.
The query-only refresh optimization inherited from #41 refreshed result membership
without rereading the rewritten saved configuration. A real-SQLite EN/RU renderer
regression reproduced both failures before the fix. ViewFilters now rereads its
saved configuration when accepted property/option identities disappear, using its
existing request-version guards and draft protection. Ordinary value revisions
retain the query-only path. The regression covers option replacement, property
removal, configuration-read counts and preservation of authored drafts.

Both review axes accepted these repairs. All 27 filter/removal tests and 83
folder-assignment/viewport/CI-route tests passed locally; build, typecheck, lint,
documentation links and diff checks passed. The focused desktop-shell route now
also runs the original views consumer on all three OSes and the affected filter,
metadata-removal, viewport and assignment interaction tests. Ordinary coverage,
product timeouts and original assertions remain intact. The production filter
change supersedes the earlier reuse of `41623b2` installer evidence: installers
and full desktop acceptance must be renewed for the repaired candidate. Current
native replay and remote gate results remain in the linked GitHub checkpoint.

The complete local original `smoke:views -- dev` replay then passed all six
EN/RU report entries, including four folder assignments, eight metadata-removal
combinations, layout/filter/grouping lifecycle, restart, unchanged fixture files,
normal shutdown and cleanup. Its retained report is
`work/issue-48-ci/views-filter-repair/evidence.json` (local, no remote SHA claim).

## Subsequent native authoring and MultiSelect gates

Focused run `39314196926` passed all three OSes on `51d076f`; inspected reports
confirm original shell and complete views lifecycles, native shutdown/cleanup,
220 macOS or 219 Windows regressions and 108 Windows creation/recovery screenshots.
Renewed installer runs `39315201734` (macOS 14.8.9 arm64) and `39315489549`
(Windows Server 2025 x64) passed on that SHA. Downloaded installation reports
confirm installed bundled backend/SQLite, EN/RU, identity/language reopening,
replacement/reinstallation data preservation and cleanup. Windows desktop 11 human
release acceptance remains a separate boundary.

Full run `39315194250` passed common and the macOS/Windows 2022 platform suites,
then failed two later original native commands. The macOS runtime stopped at the
unchanged-name rejection's exact-draft assertion before submission. Its retained
screenshot shows the existing name duplicated; its receipt records zero service
requests and successful initial editor readiness. A reduced direct/grouped
rejection probe passed repeated UI cases; it did not establish the hosted cause.
A real-Electron control injecting selection collapse during native `beforeinput`
reproduced the same pre-submit failure. This proves that mechanism is possible,
not that it caused the historical hosted failure. The driver now avoids redundant
fill when the input already equals the requested draft, while retaining exact-text,
Enter, unchanged-outcome and no-mutation assertions. Changed drafts retain their
original replacement action. The native control changed from red to green.

Windows 2022's original MultiSelect command timed out expecting the sibling's
renamed selection on a closed value button. Its retained DOM instead contains an
open editor with an authored-draft external-change notice. The original local
replay stopped earlier at the already recorded native shutdown timeout; separate
reload-only debug probes passed both UI languages. They do not reproduce or prove
the hosted failure, and an injected-focus probe failed earlier at a different
visibility check. No MultiSelect implementation or original driver assertion was
changed or declared repaired. The next tight hosted loop replays that original
command on Windows 2022.

Both review axes accepted the unchanged-name driver and narrow `shell-runtime`
route: only original macOS development runtime and Windows 2022 development
MultiSelect, strict regression/build gates, failure propagation and exact-SHA
artifacts. All 48 runtime/route tests and the full native readiness file passed
locally. Full acceptance remains behind both original focused commands. Production
source is unchanged from installer-tested `51d076f`; these changes affect native
test authoring and CI routing only. Debug probes remain clearly marked under the
ignored `work/issue-48-ci` evidence directory and do not establish full acceptance.
