# CI checks and diagnostic routes

Read when selecting or diagnosing a CI route, changing CI scheduling, or checking exact-SHA acceptance. [Development](development.md#verification) owns verification policy; [.github/workflows/desktop-ci.yml](../.github/workflows/desktop-ci.yml) owns actual job wiring.

## Candidate and handoff

Use the [implementation sequence](development.md#implementation-sequence) before dispatching candidate acceptance. The candidate includes application changes, tests, fixtures, CI routes and relevant repository reports. Record observed local results before committing it; keep pending CI/integration status in the GitHub issue checkpoint linked from the plan.

After acceptance, record the run/attempt, tested SHA, actual checks/artifacts, delivered SHA and integration verification in that checkpoint. A fast-forward delivery of the same commit retains exact-SHA evidence. If a required later change creates another commit, identify its affected boundary and renew the checks it requires; state explicitly when a documentation-only change has separate checks rather than describing its SHA as platform-tested. Preserve existing workflow defaults and required platform coverage.

## Failed Actions loop

Apply this loop automatically when a GitHub Actions check fails during an authorized task, including continuation in a new window. The agent invokes `diagnosing-bugs` without requiring another user command. Executor selection remains governed by [development](development.md#executor-selection); CI failure does not select Ralphex. Continue within existing implementation/push/Actions authorization; request only genuinely missing access or consequential decisions.

1. **Retain the failure.** Record the run/attempt, exact SHA, failed check, OS, original command and relevant logs/artifacts. Distinguish a failed check from a cancelled run, skipped stage or unavailable evidence.
2. **Diagnose and repair.** Follow `diagnosing-bugs`: build a red-capable reproduction, test falsifiable hypotheses, make the scoped repair and verify a meaningful regression. If original evidence cannot identify the cause, retain that limitation and add bounded diagnostic evidence instead of claiming causation or retrying unchanged inputs until green. Preserve product assertions, deadlines, ownership and cleanup gates.
3. **Run only the affected failed checks.** Map the actual failures to focused commands on the affected OS, with necessary build/fixture prerequisites and relevant repair regressions. Select an existing manual route only when it matches those failures. If no matching route exists, add or narrow one before dispatch; the historical route names below are not a generic list to replay. Do not substitute an entire full suite for an addressable failed step. A rerun of an old failed run tests its old SHA, not the repair.
4. **Keep full CI behind the focused gate.** While preparing repair commits, use the repository's supported push-CI suppression (`[skip ci]`) and explicitly dispatch the focused route for the repaired SHA. Keep ordinary workflow defaults intact. Inspect the original focused command's result and required artifacts; diagnostics alone, missing evidence, skips and unreached stages do not pass this gate. A new focused failure returns to diagnosis.
5. **Run full CI after focused success.** Once every affected failed check passes and its evidence is inspected, dispatch the full acceptance route on that same reviewed SHA. Finish outstanding coordinated pushes before this dispatch. A new full-CI failure returns to step 1 with a new failure map; retain prior evidence rather than restarting unrelated checks.
6. **Deliver only after full success.** Inspect required full-run artifacts and apply the existing acceptance/integration policy. Focused success is not task completion and does not reduce required platform/runtime coverage.

Keep the current SHA, failure map, reproduction/repair evidence, focused run/result, full run/result and next unresolved gate in the task's existing checkpoint. On a new window or context reset, read that checkpoint and verify the current branch/SHA and run status before continuing from the unresolved gate. Do not default to full CI or replay completed gates merely because the conversation restarted; code changes or new failures determine which evidence needs renewal.

### CI test scheduling

Ordinary push and pull-request runs execute common DOM/mocked-client and pure-helper tests once on macOS, alongside lint, typecheck and documentation links. The macOS, Windows latest and Windows 2022 matrix builds once per OS and runs the remaining platform tests, then the existing development and packaged runtime acceptance routes. SQLite, real filesystem, process, native and mixed UI/backend suites remain in that matrix. Production move, recovery and native acceptance assertions are unchanged.

`npm test` still builds and runs every test locally. Test discovery is explicitly limited to `tests/` by the suite runner; sibling worktrees are outside its inventory. After a build, `npm run test:all` runs every test without rebuilding; `npm run test:platform` selects platform suites. `npm run test:common` requires no application build. The explicit common list lives in [test-suites.mjs](../scripts/test-suites.mjs); new test files default to platform coverage. `node scripts/test-suites.mjs <all|common|platform> --list` prints the selected files. Partition controls require complete, nonoverlapping coverage and preserve platform-sensitive suites.

CI packages its already verified build with `npm run package:built`; local `package:dir` retains its fresh-build behavior. A failed prerequisite stops dependent acceptance steps, while failure evidence uploads retain `always()`. New commits cancel older runs for the same event/ref. Push and pull-request identities remain distinct.

Isolated observer, early rename/category service and Windows selection/rename/resolver investigation jobs are available through manual `workflow_dispatch` with `diagnostics: true`. Historical API/CLI experiments retain their separate `legacy_windows_diagnostics` opt-in. Their focused test files remain covered by platform suites during ordinary CI; their standalone experiments are additional diagnostics. A diagnostic artifact or skipped job does not establish product acceptance. Historical evidence directories and artifact names containing `full-suite` now carry the original platform-suite call/checkpoints; they retain exact SHA/run/attempt provenance.

Manual `workflow_dispatch` defaults to `checks: full`. Select `checks: failed` with diagnostics disabled to run only the Windows latest pure-Node observer suite and the macOS development rename/Reveal route. These independent jobs retain original failures and exact SHA/run/attempt artifacts. Focused success is a prerequisite for requesting full acceptance, not a replacement for the ordinary three-platform routes. Rename diagnostics retain the original typed native Reveal receipt on macOS before checking the UI acknowledgment, including rejected responses; they do not relax acceptance or identify historical causes by themselves.

For the later Windows runtime failures, select `checks: failed` and `runtime_failures: true` instead. This runs only the original direct creation/Reveal route on Windows latest and the development runtime on Windows 2022, preceded by the existing isolated category rename/sharing comparisons on Windows 2022. The original scenario still runs if a comparison fails, provided its build passed. Creation diagnostics retain the existing finite typed Reveal receipt on both desktop platforms before native assertions. These are diagnostic routes, not a waiver or proof of historical causation; original failures and unreached stages remain failures.

This scheduling change reduces repeated execution, not the test inventory. Actual Windows acceptance and any pre-existing failures remain pending until a reviewed-SHA run completes. Compare observed job durations after the change before claiming a measured speed or cost reduction.

For integration run failures in category layouts and direct creation, select `checks: failed` and `integration_failures: true`. This takes precedence over the older runtime-failure selector and runs only the original category-layout command on macOS and direct development creation/Reveal on Windows 2022, with relevant UI and Windows bridge regressions. Failure artifacts retain exact SHA/run/attempt provenance. The Windows bridge emits only finite private phase/reason markers on failure; these diagnose a rejection and never authorize success or expose exception text. Production deadlines, binding guards, single dispatch and cleanup requirements stay unchanged. Focused evidence must be inspected before requesting full acceptance.

For the issue-29 category-layout overflow on all three platforms, add `category_layout_only: true`
with `checks: failed, integration_failures: true`. Only the original layout
route runs on macOS, Windows latest and Windows 2022; its existing EN/RU state, width and shutdown assertions remain intact.
The flag defaults to false and does not alter ordinary/full acceptance or the
existing combined integration-failure route (macOS layouts and Windows 2022 Reveal). Inspect its exact-SHA artifact before
requesting full acceptance.

For the issue-21 macOS editor-readiness failure, select `checks: readiness` to run only the original real-Electron readiness suite and retain its test log with exact SHA/run/attempt provenance. It requires no application build. Timely and late delivery use real renderer operands and a controlled host clock to verify the unchanged default deadline and truthful unknown evidence. Focused success still precedes full acceptance.

For the issue-22 Windows latest final packaged-runtime cleanup failure, select `checks: windows-release`. This skips common/full-matrix jobs and runs only Windows latest: build prerequisites, lifecycle/startup/route regressions, packaging/resource validation and the original `npm run smoke:runtime -- release` command. Exact SHA/run/attempt evidence is retained even on failure. The rename harness records the finite cleanup predicate and counts without PIDs, paths or raw probe exceptions. This is diagnostic evidence; parent/backend exit, native cleanup and fixture-removal gates and their deadlines are unchanged. Focused original-step success is required before dispatching full acceptance on the same candidate.

For the subsequent issue-22 recovery-fanout and grouped rename failures, select `checks: issue22-failures`. Only Windows latest and macOS run: build/capture/route prerequisites, the Windows `backend-lifecycle.test.mjs` file and original macOS `npm run smoke:runtime -- dev`. Commit/observer event contracts remain distinct, original runtime assertions/deadlines stay intact, and finite submission receipts contain no names or paths. Both focused scenarios and retained artifacts must pass before full CI.

For issue #31's direct-recovery fixture failure on Windows 2022 and original
macOS development runtime, use `checks: issue22-failures` with
`recovery_windows_2022: true`. This selects the exact backend lifecycle file on
Windows 2022 and unchanged `npm run smoke:runtime -- dev` on macOS. The selector
default remains false, retaining the earlier Windows latest route and ordinary
full coverage. The manual-recovery fixture holds unrelated notification scans;
automatic reconciliation has separate coverage. Failure-only receipts distinguish
review error code and whether the same logical project already occupies the target,
without paths or service exception text. Inspect both original commands and their
artifacts before full acceptance on the repair SHA.


For the issue-23 Windows latest development creation crash/recovery shutdown failure,
select `checks: creation-shutdown`. This runs only Windows latest: the existing build,
quit-evidence/lifecycle/route regressions, and the original
`npm run smoke:runtime -- dev --creation --skip-native` command. The fixture captures
finite owned-process quit phases without names, paths, PIDs or exception text; original
normal-quit/exit/cleanup assertions and deadlines remain unchanged. The exact-SHA artifact
retains all original scenario outcomes, including failure or unreached restart stages.
Missing phase evidence does not prove a cause, and a diagnostic run alone is not full
acceptance. Inspect original-step focused success before dispatching full CI on that SHA.


For the issue-24 Windows 2022 raw legacy realpath stress failure, select `checks: raw-rename`.
The same selector now independently runs the original failed macOS dev runtime command
after build, preserving exact-SHA submission receipts and logs. Both matching jobs must
pass before renewed full acceptance; input preparation verifies exact authored text
before Enter without replaying filesystem effects or accepting a different outcome.
After macOS original focused success with unchanged runtime sources, dispatch
`checks: raw-rename, raw_windows_only: true` to focus a remaining Windows-only
failure. The flag defaults to false, affects only this manual macOS job, and
leaves ordinary/full platform coverage intact.
macOS also runs the original observer CLI cancellation cases after dependencies,
including when runtime fails, with strict exit and retained output.
The Windows raw-rename job runs only Windows 2022 with the existing service-fixture build, bounded idle/native/
legacy/production-scan comparisons and the original Windows rename regression file.
The original test runs after a comparison failure when its build passed; no continuation
or success waiver is applied. Exact-SHA comparison artifacts preserve negative renames,
data invariants, overlap and termination. The regression assertion now retains complete
allowlisted fixture context. A later actual legacy-stress EPERM disproved the
blanket always-success diagnostic expectation: Windows can deny a parent move
while child metadata is being read. The initial single failure remains negative
and counted. Only Windows stress_legacy EPERM may add a separate post-reader
move/restore control: both workers exited, service closed, zero watches/timers,
unchanged full fixture identity/bytes before the control, one same-API forward move
and one restore, exact identity/bytes (including SQLite) after each. Missing proof,
extra attempts, persistent denial, other errors, changed state or unknown child
termination remain failures. Idle, production-scan and product originals stay
strict. This proves post-quiescence movability, not the historical blocking actor.
The finite parser retains both additional operations and original negative response/
failure count; no reader-side ENOENT is invented. Original-step focused success is
required before dispatching full acceptance on the same reviewed SHA.
After the additional local App fixture initial-list race, add
`raw_renderer_check: true` to the raw-only selector. A separate macOS job builds
the service fixture and runs the original `renderer-app.test.tsx` file with strict
pipefail and exact-SHA logs, alongside unchanged Windows raw checks. This flag
defaults false; ordinary/full routes and `raw_windows_only` behavior stay intact.
Both affected original files must pass before full same-SHA acceptance.
The renewed raw-only investigation also executes an actual PowerShell event-filter
control and four separate original legacy fixtures with a unique owned Kernel-File
collector set. The owned set is created with a 15-second run-for setting before
start, explicitly stopped/deleted, and has a 16 MB circular file. Stop is requested
asynchronously after the owned rename-worker close, with fixture-finally fallback;
the original completion signal and one-second resolver lifetime do not await it.
The collector retains
5-second command bounds and a 10-second bound per reader. A full-decode baseline
and a time-filtered reader inspect the same ETL in alternating order, after
a clock-only peek capped at 64 records (three readers total). The peek exports
only aggregate provider count and relative time range; query errors use fixed
allowlisted IDs without exception text. The
filtered reader retains only the existing 1-second-before/25ms-after window and may
miss older name associations. Unknown reader termination forbids a second reader
and raw cleanup. The probe requires successful interpreter controls; original
comparisons/regression remain independent. Raw ETL stays outside artifacts;
only numeric owned-fixture event fields are retained, capped at 256 per reader.
The native query preserves subsecond UTC values as round-trip strings. Installed
PowerShell hashtable-builder controls require precision loss with DateTime operands
and exact millisecond preservation with strings. Native ProviderName filtering
is removed as a separate one-variable comparison; the shared decoder still checks
the exact provider before any fields are decoded. Actual ETL proof remains separate. IRP/FileObject reuse is guarded,
and separate before/during/after queues retain at most 256 records. Missing or truncated
events never establish handle absence (`lossVerified: false`); positive event correlation
does not by itself identify the actor that blocked a historical rename. Collector stop
and owned set deletion must be confirmed before raw trace cleanup; unknown stop
or unavailable event evidence aborts further probes. Original
bounded comparisons and the original regression still execute independently after a
probe/control failure when the build passed. This temporary debug route changes no
product operation, deadline, retry or skip. Its historical strict legacy-success
oracle is now governed by the explicit post-quiescence diagnostic contract above.


For the renewed issue-24 unit failures, select `checks: issue24-failures`. The original
`test-suites.test.mjs` scheduling/routing file runs on macOS, Windows latest and Windows
2022. Windows 2022 also runs the original runner startup/terminal cases from
`ralphex-observe.test.mjs`; that independent step still runs after a routing failure when
its dependencies passed. Only npm dependencies are required, with no application build or
unrelated runtime suite. Pipefail retains both commands' exits; exact-SHA/run/attempt test
logs upload even on failure. Ordinary push/full defaults and the original three-platform
acceptance route remain unchanged. Inspect every affected focused result before full
acceptance on that same reviewed SHA.


For the issue-24 Windows latest category-checkpoint failure, select `checks: category-fixture`.
Windows latest runs the existing build and original `project-category-move-fixture.test.mjs`
file. Windows 2022 independently runs the original failed `npm run smoke:runtime -- dev`
after building, preserving the unavailable-category submission proof and runtime observations.
Pipefail preserves both exits; exact-SHA logs and each sanitized checkpoint upload even on
failure. Malformed-result controls now corrupt only their reached injection, retaining earlier
real service/lifecycle failures. No restart retry, deadline, production assertion or cleanup gate
is relaxed. Inspect original-file success and retained checkpoints before full acceptance on
the same reviewed SHA; a better diagnostic does not establish the historical restart cause.


For the subsequent issue-24 Windows latest initial category-service connect and
Electron cleanup-control mount failures, select `checks: issue24-startup`.
It builds once and independently runs the original category fixture and readiness
files on Windows latest; readiness still runs after a category failure if build
passed. Strict pipefail and exact-SHA logs/checkpoints retain both original exits.
The fixture-owned navigation completes within the existing firstWindow allowance;
cleanup controls retain primary/secondary errors without an unrelated DOM mount.
Category connect failures retain finite controller startup stages, including before
a diagnostic injection is reached. The original 6s startup, scenarios, shutdown,
cleanup and invalid-diagnostic assertions remain mandatory. Focused success and
artifact inspection precede full acceptance on that same reviewed candidate.


After that route's unchanged readiness file passes, `startup_category_only: true`
focuses a remaining category failure; the flag defaults to false and affects
only the focused readiness step. A timed-out owned-worker wait is now explicitly
rejected at its original 1s deadline, retaining a finite running/stopped/unknown
probe of only its captured owned PID. A stopped probe without an exit event still
fails. Original scenario, terminal, count, normal shutdown and cleanup assertions
remain; actual OS stop/notification causation is not inferred from the snapshot.


For the later Windows latest and Windows 2022 readiness navigation/context failures in issue24,
dispatch `checks: readiness, readiness_windows: true`. This existing route
runs only the original readiness file and its regressions on both Windows runners with
npm dependencies and distinct OS/SHA/run artifacts; the flag defaults to the historical macOS route and does not
change ordinary/full coverage. Main load receipts are followed by the exact
fixture data URL's Page load within the same30s firstWindow allowance. Different
fixture navigation URLs prevent an old load state from satisfying a new load.
Inspect the original-file result/log before renewed full same-SHA acceptance.

For issue24 full run38636598781's additional macOS grouped packaged creation/native
acknowledgment failure, include `readiness_package_creation: true` in that same
`checks: readiness, readiness_windows: true` dispatch. The independent macOS job
builds, checks the Reveal service regressions, packages and validates the artifact,
then runs the exact original grouped packaged creation/native command without skips.
Its separate artifact retains exact SHA/run/attempt and all original target, reply,
shutdown/restart and owned cleanup assertions. One union dispatch avoids branch
concurrency cancelling a second focused run. Full acceptance still follows only
after every affected focused result and artifact passes on the same SHA.

For full run38641861932's original Reveal-file failures on Windows, dispatch
`checks: readiness, readiness_reveal_windows: true, readiness_package_creation: true`.
This replaces the unrelated editor file with the original Reveal regression file
on both Windows runners and preserves the exact macOS packaged native command
after the service repair. Both Windows logs retain OS/SHA/run/attempt provenance;
the original assertions and full/default scheduling remain unchanged.

Add `readiness_native_windows: true` to that same union for the complete
run38641861932 failure map: Windows latest independently runs the exact original
direct development creation/native command after a successful build, even if
its service/bridge regression file fails. Both Windows jobs include the existing
bridge regression file. Native owner expiry retains its finite protocol state
and owner_deadline reason without changing the12-second deadline, one navigation,
one GO/selection, exact-view guards or owned-process cleanup. This state is the
last token acknowledged by main, not proof of the blocked COM call or OS actor.

For run38645981450's repeated Windows latest native expiry after the full UI
prefix, add `readiness_native_prefix: true` to the focused Reveal/native union.
It retains the original Ladle build, both original layout commands and original
dev creation/crash command before the exact failed direct native command. The
last command still runs independently after successful application build if a
regression or prefix fails; every failed predecessor remains a failed job.
The focused command defaults to `WORKSPACE_REVEAL_TRACE=0`, matching the full
product runtime. `readiness_native_trace: true` explicitly enables diagnosis. Fixed
bootstrap/read-boundary markers are deduplicated (19 maximum), validated under
the unchanged1024-byte protocol limit and retained as first received boundary
latencies from adapter spawn. They neither authorize GO nor identify the current
blocked call after repeated polls. The `binding_returned` marker records whether at least one binding read completed; its presence confirms a completed read; absence means no completion marker was received and leaves read/exception/delivery hypotheses unresolved. Default runtime behavior has tracing disabled.
Actual Windows interpreter controls, existing view/binding/permit/deadline tests
and original target/native/quit/cleanup assertions remain required.

For issue #26 full run 38727412661's macOS packaged MultiSelect property-creator timeout,
select `checks: multiselect`. This runs only macOS build prerequisites, real Electron
loading/keyboard and MultiSelect regressions, packaging/resource validation and the
original `npm run smoke:multiselect -- release` command. The original command still
runs after successful packaging even if a regression fails, and every failed step
keeps the job failed. Exact SHA/run/attempt metadata, regression output and runtime
JSON/screenshots are retained. Production deadlines, keyboard activation, EN/RU,
restart, set/visibility, normal quit/backend exit and owned cleanup assertions remain
unchanged. Inspect both the original command and required evidence before renewed
full acceptance on that same reviewed SHA.

Issue #26 full run 38732178491's sole Windows latest failure is the final category-move
fixture ownership gate inside the original packaged `npm run smoke:runtime -- release`.
Use the same `checks: windows-release` selector. Its regression prefix now includes
`project-category-move-runtime.test.mjs` alongside lifecycle/startup/route checks.
Category-move evidence retains the exact finite `inspectOwnedProcesses` predicate used
for cleanup (reason/counts only), matching the existing rename fixture's diagnostics.
The stopped value, all PID/parent/startup uncertainty restrictions, original scenarios,
34 normal quits/backend exits, deadlines and confirmed-removal requirements remain
unchanged. Missing earlier predicate evidence cannot establish whether the failure was
PID reuse, an owned live process, or incomplete observation. Inspect the original
Windows command and this evidence before any renewed full acceptance on the same SHA.

For issue #26 full run 38738171579's Windows latest ETW-control regression failure,
select `checks: etw-controls`. It runs only the original
`node --import tsx --test tests/windows-rename-etw.test.mjs` file on Windows latest,
with route guards and exact-SHA/run/attempt test-output evidence. The test retains
finite phase, elapsed, killed/signal/code and known-error markers when PowerShell
fails; no raw additional stderr, paths or event payloads are logged. The existing
ten-second child limit, native-builder precision control and all attribution,
retention, privacy and equality assertions remain unchanged. This diagnostic does
not prove the historical cause; focused original success and artifact inspection
are required before another full run on the same reviewed SHA.

The same `etw-controls` selector additionally renews the subsequently failed local
property-driver native fixture on macOS, in an independent job running only
`tests/property-editor-driver.test.mjs`. It retains its own exact-SHA/run/attempt
output and failures; both original files and artifacts must pass before full CI.
The native fixture uses one Playwright-owned normal quit under the unchanged
ten-second bound; forced cleanup after failure never satisfies normal closure.

For full run38808047668's sole macOS property-driver setup failure, select
`checks: property-fixture`. It runs that exact original property-driver file only,
using the existing artifact/normal-quit contract. The old `etw-controls` union and
ordinary full/push defaults remain intact. The negative test arms its unchanged
100ms caller deadline after HTML/listener preparation; it still requires timeout,
zero activation and no editor. Setup is not the operation under this short deadline.
Inspect its original-file result before renewed full acceptance on the same SHA.

For issue #26 run 38761764716's Windows latest creation shutdown timeout, the
existing `checks: creation-shutdown` route matches the exact original command.
It includes the real-Electron deferred-quit regression and runs the original
creation matrix independently after regression failure when the build succeeded.
The runtime helper gives Playwright sole ownership of the normal quit request;
its ten-second bound, strict failure/forced-cleanup behavior and all caller
backend/fixture checks remain. The native red/green control proves a competing
quit can bypass deferred cleanup, not the exact historical timeout cause.

The same creation route includes the native input-focus readiness regression
after a local original-matrix one-shot focus failure. Creation waits for visible,
app-focused input in its existing 15-second page allowance, retaining the explicit
focus assertion; the driver never acquires focus. Absent app focus still times out.

After focused run 38765621210 exposed concurrent first-use Electron downloads
and native launch failures, all/platform suite execution resolves the pinned
Electron binary once before parallel workers. Common tests and `--list` retain
their existing behavior. The creation-focused route performs the same serial
preparation before its native regressions; original creation runs independently
after build/preparation success. No deadline, assertion, inventory or failed-step
result is relaxed. The historical OS-level extraction mechanism remains unproven.

For issue #26 run 38767720986's Windows latest category checkpoint utility-exit
failure, select `checks: category-fixture, category_fixture_only: true`. This
runs only the original failed Windows latest file; the flag defaults false and
preserves the historical Windows2022 runtime route. On Windows, all/platform
suite execution runs the category fixture file in an exclusive first batch,
then every other selected file once. Failures/signals remain failed across
batches; the original one-second exit deadline, diagnostic and cleanup assertions
are unchanged. Common/list and non-Windows execution are unchanged. Isolation
tests a native-load/event-delivery hypothesis; exact historical causation remains
unproven. Focused original/artifact acceptance still precedes full CI.

For issue #26 run38772058082's Windows2022 App Reveal-feedback failure, select
`checks: app-fixture`. It builds and runs only the original renderer-app file on
Windows2022, independently after route-check failure when build succeeds, with
strict output retention and exactSHA/run/attempt provenance. The failing test
retains finite click/typed receipt/lifetime counters and known-message booleans;
original interactions, waits and assertions remain unchanged. Diagnostic evidence
and local success do not prove the historical cause; focused original/artifact
acceptance remains required before full CI on the same reviewed SHA.

For issue #26's repeated Windows latest direct creation/native owner expiry,
focused38781872446 removed only the UI predecessor block and passed the unchanged
original command, exact selected-target observation, restart and cleanup. The
Windows latest full job now runs that direct native command immediately after
build, before platform workers and layout/recovery workloads. Other OS order is
unchanged. The original command runs exactly once per OS; all later checks and
strict native/ownership/deadline/cleanup assertions remain required. This is
scheduling isolation, not proof of the historical Windows/COM cause.

Validate this order with `checks: readiness`, `readiness_reveal_windows: true`,
`readiness_native_windows: true`, `readiness_native_prefix: true` and
`readiness_native_early: true`. Native acceptance runs first after build; all
relevant native/service controls and original layout/recovery predecessors still
run afterwards, even if that native command fails. The default early flag is
false, preserving the historical reproduction order. Exact-SHA artifacts and
full acceptance are required after focused success.

The Windows binding uses direct .NET IDispatch reads rather than PowerShell COM
member discovery. The ShellWindows collection return also passes through the
opaque managed helper, with genuine Count/IUnknown/typed-Item controls; this is a
scoped latency hypothesis, not unique historical-cause proof. Renew its cold original with `checks: readiness`,
`readiness_reveal_windows: true`, `readiness_native_windows: true`,
`readiness_native_early: true`; leave the historical prefix and `readiness_native_trace` disabled. Inspect the
exact-SHA native result, COM/UIA target evidence, restart, shutdown and cleanup
before full acceptance. Temporary COM/host/timing comparison routes are removed;
no Explorer warm-up precedes this original. Focused npm installation retains
verbose failure output under strict pipefail, including failures before build,
without retry or runtime substitution.


For full38808047668's Windows category failures and the later Windows2022 rename
Reveal failure, select `checks: runtime-observation`. Both Windows latest and 2022
original development runtimes run, preceded by observer/receipt/UI controls and
the minimized real category UI command. Only Windows2022 also runs the existing
isolated real-service, idle, child-sharing and native/legacy-realpath/production-scan
comparisons. Those comparisons own disposable roots and do not attribute the
historical OS handle. Each original command runs independently after a successful
build, including after control/comparison/minimized failure. `readiness_native_trace`
defaults off; enable it explicitly only for the bounded native boundary comparison.
Inspect actual bound replies, independent no-effects proofs and native failure
stages in the exact-SHA artifacts. The focused build retains strict-pipefail output
and verbose dependency preparation diagnostics even when runtime is unreached.
Rename cleanup records confirmed backend exits per owned launch occurrence, so
later numeric PID reuse does not invalidate an earlier exit proof. Unknown or
new owned occurrences remain unconfirmed until independently verified absent.
Default/full scheduling and the historical
Windows2022-only category-fixture selector remain unchanged. No retry, observer
suppression, settling wait or deadline change is added to product or original
runtime acceptance. Inspect original/comparison artifacts before choosing a repair
or requesting full acceptance.

Focused runtime-observation uploads completed control logs before the long
original runtime, with exact SHA/run/attempt provenance. The original build-only
prerequisite, strict exits and final always-upload remain unchanged.

Windows Reveal obtains each fresh Shell.Windows candidate set through SDK-typed
_NewEnum/IEnumVARIANT, avoiding indexed Item acquisition observed active during a
failed quiet request. Bounded exhaustion, validated counts and unique COM identities
precede the existing exact parent/target, Document, HWND/Explorer/UIA, readiness,
permit and pre/post-selection checks. Count agreement is not atomic membership
proof. There is no retry, indexed fallback, warm-up, cache or deadline extension.
Temporary checkpoint timers and acquisition switches are removed before final
ordinary focused/full acceptance. Immediate finite read tracing remains opt-in;
window_candidate marks processing of an enumerated candidate.

### View-backed Ladle fixture failure

For issue #28's missing filter-query mock in the original category layout capture,
select `checks: view-fixtures`. The focused matrix runs macOS, Windows latest and
Windows 2022: existing category/rename/recovery UI regressions, the Ladle build and
the exact original `node scripts/smoke-discovery-layouts.mjs --category-move` command.
It retains SHA/run/attempt/platform provenance, original readiness deadlines,
screenshots, interactions and normal shutdown assertions. Inspect all affected
original-step results and artifacts before dispatching full acceptance on the same
repair SHA. The ordinary/full matrix remains unchanged.


Issue #28 run 39038352303 additionally reproduced the original App Reveal-feedback
failure on both Windows runners: a typed `missing` response accompanied by visible
`uncertain` feedback. `checks: app-fixture` now maps the unchanged original file to
both affected runners, with separate artifacts. A bounded, path-free test timeline
retains projection state/revision, source event ordering and Reveal start/reply
phases on success and failure. Thirty local repetitions passed; that result does
not identify the remote race or waive its original assertion. The existing
`checks: issue24-failures` route separately replays the original routing file on
all three platforms after the `view-fixtures` inventory repair.

For issue #31 full run 39064672849's Windows latest observer worker exit failure,
select `checks: failed, observer_fixture_only: true`. This retains the original
Windows observer/runner/diagnostic files and excludes only the unrelated macOS
rename job for that explicit selector. The default false preserves historical
routing and full coverage. Strict pipefail and an always-uploaded exact-SHA log
retain original exits independently of collector validation. A failed real PID
denial worker emits only finite status/exit/error-class markers, never paths or
raw logs. A successful isolated run does not identify the historical worker cause;
inspect the original file and evidence before renewed full acceptance.

For issue #32 run39113135361's sole Windows latest packaged Number creator
failure, select `checks: number`. The Windows latest-only job retains build,
real-Electron delayed/enabled creator controls, Number service/UI regressions,
packaging/resource checks and the original `npm run smoke:number -- release`.
The original runs independently after regression failure when packaging succeeds;
strict output capture, failed exits and exact-SHA/run/attempt artifacts remain.
A deterministic delayed-disabled control reproduces the old direct focus/Enter
missing-form pattern. The Number runtime now uses the existing enabled creator
helper without changing keyboard entry, deadlines or product assertions. The
original failure lacks a focus/enablement timeline, so its unique historical
cause is not established. Inspect original EN/RU/restart/shutdown/cleanup evidence
before renewed full acceptance on the same reviewed SHA. Ordinary push/full and
all three platform routes remain unchanged.

For issue #32 run39116052433's Windows latest property-driver normal-close
failure, select `checks: windows-property-fixture`. It reuses the existing
property fixture job on Windows latest only; the historical macOS and ETW
selectors keep their OS. Route/batch guards precede the unchanged original
`tests/property-editor-driver.test.mjs`, which still runs independently after a
guard failure when dependency installation succeeded. Exact-run provenance and
strict original output are uploaded even on failure.

Windows all/platform execution now gives this native fixture its own batch after
the existing category utility-exit batch, before all remaining files. Every file
still runs once, and any failed/signaled batch keeps the suite failed. Other OS
and common execution are unchanged. This tests native cross-file load isolation;
it does not establish historical shutdown causation. Failure-only finite event
receipt timestamps distinguish close request/result, app quit receipts, parent
exit and stdio close without logging paths or PIDs. The ten-second normal-close,
negative caller deadline, single activation and cleanup assertions remain intact.
Inspect the original focused result before renewed full acceptance.


For issue #33 full run39124807104's Windows latest development rename authoring
failure, select `checks: rename-authoring`. Only Windows latest runs the real-Electron
authoring/readiness controls and original `npm run smoke:runtime -- dev` command.
The original command runs after a control failure when its build succeeded; strict
pipefail and exact SHA/run/attempt artifacts preserve both outcomes. Ordinary/full
routes remain unchanged. Inspect the original rename receipt, full runtime outcome,
normal shutdown and cleanup before a renewed full run on the same candidate.

The lost/deferred keyboard-delete control reproduces the original failure pattern
without submitting a filesystem command. Nonempty draft preparation now uses one
standard locator replacement and retains exact authored-value verification before
Enter; empty drafts still require an exact empty result. This removes a redundant
separate Delete dependency, without proving the historical Windows event-loss cause,
relaxing product assertions or replaying rename commands.

For issue #33 run39127698398's cold Windows latest creation Reveal exception,
the readiness native route above retains its original command and ordering.
Failure packets may additionally carry the last allowlisted read boundary and
coarse exception class, only for readiness/precommand/postcheck exceptions.
This failure-only context is independent of opt-in trace, resets each read and
never includes exception text, paths or HRESULTs. It does not change selection
permission or readiness. Validate protocol and actual PowerShell controls plus
the untraced cold original before renewed full CI; a traced success alone does
not establish the historical cause or satisfy full acceptance.

For integration run39136222601's Windows2022 premature-main-exit rename
fixture failure, select `checks: rename-fixture`. The Windows2022-only job
builds and runs the original `tests/project-rename-fixture.test.mjs`, retaining
strict exits, exact-SHA/run/attempt provenance and each control's bounded
checkpoint evidence. The failed original observed one utility instead of five;
this does not identify the cause of the earlier worker exit. The focused route
adds no retries, deadline extension, reduced worker count or product assertion
changes. Inspect its original result and checkpoints before renewed full CI.

For issue35 full39140454210's Windows latest delayed-focus property fixture
normal-close failure, use the existing `checks: windows-property-fixture` route.
The unchanged ten-second normal-close gate observed main quit/Node exit, with
parent exit only at forced cleanup. Failure-only finite page/context/application
close receipts now distinguish window/protocol lifetime from parent lifetime.
They observe public events and issue no quit, focus, retry or cleanup commands.
The historical native cause remains unproven. Inspect the exact-SHA original
file and retained timeline before renewed full acceptance.

For issue35 full39142202230's Windows latest category fixture evidence-write
control exit1 (expected0), select `checks: category-fixture`,
`category_fixture_only: true`. The intentional occupied evidence destination
prevents writing its checkpoint; the original exit assertion now retains the
already validated private-safe finite diagnostic/scenario/utility event packet
on failure. Handshake, normal exit, scenario, utility, privacy, cleanup and
occupied-file preservation assertions remain. No underlying cause is inferred
from exit1 alone; inspect the original focused result before renewed full CI.

## Issue 38 early Windows collection failure

Full run39165311194 at `53a58c3` failed its early Windows latest original direct
creation/Reveal command before selection. The retained finite receipt is
`readiness / collection / invalid_operation`; native selection was zero, service
reply was a rejected `native_error`, and owned cleanup passed. The subsequent
collector-document validation failed because the platform suite was unreached;
that absence does not pass or independently identify the native cause.

The managed collection guards retain fixed failure-only labels for count-result /
range, enumerator acquisition, terminal value/count, changed count, status, extra /
limited entries, null/non-COM entries and duplicate identity. The existing checks,
bounds, call order, one-navigation/selection authority and deadlines are unchanged.
No message, path or numeric HRESULT is emitted. These labels distinguish hypotheses;
they do not establish the original historical cause or authorize a retry.

Use the existing focused route with `checks: readiness`,
`readiness_reveal_windows: true`, `readiness_native_windows: true`, and
`readiness_native_early: true`; leave prefix and optional trace disabled to retain
its cold original order. Both Windows runners execute the bridge/service regressions,
and Windows latest first runs the exact failed native command. Inspect that original
result plus managed guard controls and owned cleanup before renewed full acceptance
on the same reviewed SHA. Preserve the failed full run and artifact12150238888.
