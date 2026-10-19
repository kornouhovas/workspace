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

The retained full run later completed with Windows latest failing at the same
MultiSelect line/locator as Windows 2022; its failed log was inspected. Focused
run `39318574129` on `9c8ebeb` reproduced that same original Windows 2022 failure,
with an open editor in the downloaded DOM. This supplies a repeatable hosted
feedback loop. A tighter actual-production Electron/SQLite probe seeds only the
empty MultiSelect editor and moves focus to another real control before the
original global Escape. The subsequent sibling assignment then reproduces the
same invisible-button timeout. It establishes the unowned keyboard-recipient
mechanism, not why focus moved in the historical hosted run.

The original driver now waits for the real editor before asserting hidden-option
absence, directs Escape to its visible Second checkbox, and asserts closure plus
return focus before sibling mutations. The exact hidden-option, sibling value,
restart, filesystem and persistence assertions remain; no mutation retry or
product deadline changed. The same controlled native probe passed after this
change, including normal shutdown and cleanup; it is deliberately a shortened
probe, not full original acceptance. Both review axes accepted the driver change.
The matching focused route now includes Windows latest, reflecting its observed
full-run failure. Its macOS command and ordinary coverage remain unchanged.

The complete original local `smoke:multiselect -- dev` then passed both EN/RU
checks, restart and sibling/hidden-option assertions, normal shutdown and cleanup.
All 55 affected MultiSelect/property-driver/route tests passed; lint, documentation
links and diff checks passed. Remote original-step acceptance remains pending.

## Category recovery observation-cache lifetime

Focused run `39319323164` on `904a4c4` passed both original Windows MultiSelect
commands; downloaded exact-SHA reports confirm both EN/RU checks, three ordinary
shutdowns and cleanup per host. Both that run and the preceding `39318574129`
passed the original rename journey, then the macOS runtime failed the same
keep-original category recovery preservation check: Current's project action was
absent. The completed failed logs and original macOS screenshot/observations from
`39318574129` were inspected.

A keep-original-only actual-production Electron/SQLite probe reproduced the same
missing action without injection. At the failure boundary, fresh public
`listProjects` reported the original project active; `observed: true` reported
that identical ID retained/unresolved, and the DOM offered Locate instead of the
category action. The observed scan remained cached across journal settlement,
which intentionally does not advance discovery revision.

The service now invalidates the source-wide observed scan after a successful
keep-original journal transaction, advances the observation lifetime to reject
pre-settlement asynchronous scans and requests a fresh observation. No discovery
revision or public event is invented; journal/identity/filesystem checks remain.
The renderer keeps ordinary observed reads. Category result acceptance no longer
calls its completion callback in addition to `run()`'s existing `finally`; one
callback refreshes each action rather than duplicating work.

The existing real-SQLite public-service keep-original oracle was strengthened with
observed projections for both source-sharing workspaces. It failed before the
repair with the same retained/unresolved association and passed afterward. It now
also holds a genuine pre-settlement async scan through controlled watcher clocks,
settles recovery, releases the old scan before queued refresh, and verifies active
projections plus healthy automatic updates after fresh observation. Actual scans,
filesystem probes, durable journal and preservation oracle remain real. The race
passed; no persistent stale projection or degradation was accepted.

The native keep-original probe then passed preservation, restart and ordinary
shutdown/cleanup. This is the explicit reduced English recovery probe, not full
EN/RU runtime acceptance. Before the race extension, all 270 category-runtime/UI/
observer tests and 136 category-service/viewport tests passed. Build, typecheck and
lint passed. Both review axes accepted the source approach; the requested race
coverage and final focused checks are renewed before dispatch. The `shell-runtime`
route includes those category/observer regressions and retains each original
native command. Because service/renderer production source changed, installers
must be renewed after matching focused success; `51d076f` installation reports are
historical for this candidate. Full CI and integration remain pending in GitHub.

The next focused run `39320758063` passed Windows latest on `e5fe6ab`. Windows
2022's original MultiSelect instead failed the immediate `editor.isVisible()`
assertion after viewport resizing; its downloaded original log and DOM show that
boundary and an open editor at failure capture. The earlier reduced local focus
probe had also failed this exact visibility line before reaching its injected
focus change. This demonstrates transient editor unavailability at the immediate
check, without establishing its rendering cause.

The driver now waits for that editor and scrolls it into view after each resize,
then retains the original visibility, document-overflow and screenshot assertions.
No mutation retry or deadline change was introduced. The complete original local
MultiSelect command passed both languages, restart, normal shutdown and cleanup.
Both review axes accepted this readiness-only delta. The preceding macOS original
runtime was left running rather than canceled. Production source remains the
category-cache repair `e5fe6ab`; remote focused/full and installer gates are pending.

## Awaiting committed asynchronous project-path reads

Full run `39322384619` on `f634ae6` passed all common/platform suites, then Windows
latest's original development views command found `A/Alpha` on disk immediately
after its asynchronous readiness predicate purported to wait for `A/Target`.
The completed job log and original views artifact were downloaded and inspected.
The other platform jobs were retained. Renewed macOS/Windows installation reports
`39322390525` and `39322690736` passed on this source and were downloaded/inspected.

The installed Playwright 1.64.0 implementation calls its predicate and treats the
returned Promise as truthy without awaiting its boolean before deciding to stop
polling. A real-Electron control returned `{result:false, checks:1}` for a
predicate that becomes true only on its third read. The new public driver helper's
native regression, initially using that same old async wait, likewise failed at
one read instead of three. This reproduces premature readiness acceptance; it is
not evidence that the service acknowledged a filesystem move before its effect.

The two affected folder-assignment waits now use sequential host-awaited,
read-only service responses, requiring exact workspace, project UUID and path.
One shared 15-second deadline includes transport and polling, with at most one
query in flight; no mutation is retried. Existing filesystem bytes, identities,
metadata, UI and width assertions remain. The native regression checks false
paths, another project and another workspace before acceptance. It is included in
the normal platform inventory automatically.

Both review axes accepted the helper and the narrow `views-readiness` route for
the original Windows latest development views command. All 86 affected native/
assignment/viewport/routing tests passed. The complete original local views replay
passed all six report blocks, normal native shutdown and cleanup. Lint, docs and
diff checks passed. Production source remains unchanged from installer-tested
`f634ae6`; new original focused/full acceptance remains in the GitHub checkpoint.

## Native MultiSelect drop phase evidence

Full run `39322384619` later completed with macOS and Windows 2022 entirely
passing, including packaged routes. Its remaining Windows latest development
views failure is recorded above. Focused `39325896292` on `8518efc` stopped at an
earlier, different views boundary: MultiSelect B-to-C assignment never exposed
Alpha's C control. Original log/DOM/screenshot/provenance were downloaded and
inspected; memberships remained A/B and C was empty. The repaired folder-path
readiness stage was therefore unreached in that focused run.

A reduced original group-assignment journey with native drag phase observation
passed locally, so the hosted drop cause remains unproven. The next diagnostic
candidate records the unchanged original B-to-C gesture: bounded first 32 event
rows, per-type counts and separate final drop/dragend records; labels, pointer
coordinates, data-transfer types and final cancellation flags only. Listeners
observe without dispatching events or altering focus, targets, gestures or
mutations. They are removed after the gesture, original failures remain primary,
and JSON stays in the owned evidence directory. Event objects remain inside the
fixture renderer and are omitted from serialization. Terminal events survive
trace truncation; flags are read after dispatch rather than from a capture-phase
microtask.

Both review axes accepted this diagnostic-only delta. The reduced original local
journey passed ten scalar/MultiSelect Table/Board cases, ordinary shutdown and
cleanup; retained receipts show B dragstart, C dragover/drop and accepted native
payload in both layouts. These passing local diagnostics do not establish the
historical hosted cause or a product repair. Lint/docs/diff checks passed. The
matching Windows latest focused original command remains the feedback loop;
full acceptance is not renewed until its actual failure is resolved.

Focused run `39327008510` on `b4a1736` reached a later failure: the folder
Alpha-to-Target move did not satisfy the real project-path deadline. All four
EN/RU Table/Board MultiSelect receipts contained accepted C drops; this does not
explain the preceding intermittent MultiSelect failure. The same observer now
wraps the unchanged first folder gesture, retaining its path, filesystem,
identity and metadata assertions. The reduced original local folder journey
passed both languages and layouts, normal shutdown and cleanup; all four
receipts contained accepted Target drops. Both review axes accepted the shared
observer reuse. This is diagnostic evidence only, with the hosted cause still
unproven and renewed original Windows focused acceptance pending.

Run `39328107342` on `068bcef6` failed that original folder-path gate again,
this time in English Table. Its exact-SHA receipt contained zero dragstart,
dragover, drop and dragend events. This establishes missing native gesture
delivery in that run, without identifying why it did not start. A reduced native
Electron geometry control passed 12 gestures each with one, two and four mouse
movement steps; it did not reproduce the hosted failure and does not justify a
step-count repair. The observer now additionally retains at most 12 pressed-mouse
movement/down/up rows, including target group and nearest button's current
disabled/draggable state. The cap can omit later mouse events; absence beyond a
full trace is not evidence of missing release. The original gesture and all
assertions remain unchanged. Both review axes accepted this diagnostic delta;
the original reduced folder replay passed EN/RU Table/Board with ordinary
shutdown and cleanup. Lint/docs/diff checks passed. Hosted cause and acceptance
remain unresolved.

The original focused command passed on `ea49e2d5` in run `39328799434`: six
report blocks, three ordinary quits/backend exits and owned-fixture cleanup.
Downloaded provenance and all eight gesture receipts were inspected. Because
this observer-only change supplies no demonstrated repair, that pass is not
treated as proof that the intermittent failure is resolved. The focused route
now repeats the original command at most three times, with independent fixtures
and separate logs/evidence, stopping at the first failure through strict shell
and pipeline exits. Ordinary/full coverage remains unchanged. Pointerdown and
the initially pressed button's later connected/disabled/draggable state extend
the bounded read-only receipt. Both review axes accepted this reproduction
delta. All 45 route checks and the reduced original EN/RU folder replay passed,
including ordinary shutdown/cleanup; lint/docs/diff checks passed. Repetition is
intended to collect a failing trace, not to retry a failure until green.

## Scrolling before native group mouse-down

The three independent original Windows journeys in `39329569086` all passed on
`f8339dea`, including 18 report blocks, nine ordinary quits/backend exits and
three cleanup gates. All 24 recorded native gestures had accepted drops. Their
downloaded exact-SHA artifacts were inspected before full run `39330579764` on
that same reviewed candidate; no repair was inferred from those passes.

That full run exposed the missing-dragstart failure on macOS in Russian folder
Table. The downloaded receipt records Alpha pointerdown/mousedown at y927,
then Target mousemove/mouseup at y479, with zero native drag events. The pressed
button stayed connected, enabled and draggable in the recorded samples. Other
platform jobs were retained rather than canceled.

A native Electron scroll-container control, with Alpha near the lower viewport
edge and Target below it, reproduced this same missing-dragstart pattern in all
36 gestures across one, two and four movement steps. The new native regression
failed at zero dragstarts with the original `dragTo`. Preparing both endpoints
before mouse-down and disabling automatic scrolling during the single native
gesture made it pass, including exact payload, one drop and unchanged scroll
between down/drop. This proves the scroll-boundary mechanism matching the new
hosted trace, without establishing every earlier intermittent failure's cause.

The shared driver helper now prepares scalar, MultiSelect and folder drag
endpoints this way. It performs one native gesture; inaccessible endpoints still
fail instead of replaying a mutation. Existing deadlines, filesystem bytes,
project identities, memberships, metadata, focus and viewport assertions remain.
All 87 affected regressions passed. The complete original local views journey
passed six report blocks, three ordinary quits/backend exits and cleanup. Both
review axes accepted the repair. Lint/docs/diff checks passed after declaring the
native fixture's renderer `document` global. The focused route now covers both
observed failing hosts, macOS latest and Windows latest, with OS-specific artifacts
and the same bounded stop-on-first-failure reproduction. Original focused and
renewed full acceptance remain tracked in GitHub; application source is unchanged.
