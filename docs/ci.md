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

For the issue-21 macOS editor-readiness failure, select `checks: readiness` to run only the original real-Electron readiness suite and retain its test log with exact SHA/run/attempt provenance. It requires no application build. Timely and late delivery use real renderer operands and a controlled host clock to verify the unchanged default deadline and truthful unknown evidence. Focused success still precedes full acceptance.

For the issue-22 Windows latest final packaged-runtime cleanup failure, select `checks: windows-release`. This skips common/full-matrix jobs and runs only Windows latest: build prerequisites, lifecycle/startup/route regressions, packaging/resource validation and the original `npm run smoke:runtime -- release` command. Exact SHA/run/attempt evidence is retained even on failure. The rename harness records the finite cleanup predicate and counts without PIDs, paths or raw probe exceptions. This is diagnostic evidence; parent/backend exit, native cleanup and fixture-removal gates and their deadlines are unchanged. Focused original-step success is required before dispatching full acceptance on the same candidate.

For the subsequent issue-22 recovery-fanout and grouped rename failures, select `checks: issue22-failures`. Only Windows latest and macOS run: build/capture/route prerequisites, the Windows `backend-lifecycle.test.mjs` file and original macOS `npm run smoke:runtime -- dev`. Commit/observer event contracts remain distinct, original runtime assertions/deadlines stay intact, and finite submission receipts contain no names or paths. Both focused scenarios and retained artifacts must pass before full CI.

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
allowlisted fixture context, while legacy rejection remains failure. This adds diagnostic
evidence, not a claim of cause or production repair. Original-step focused success is
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
product operation, deadline, retry, skip or original legacy-success assertion.


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
Only this focused native command enables `WORKSPACE_REVEAL_TRACE=1`. Fixed
bootstrap/read-boundary markers are deduplicated (17 maximum), validated under
the unchanged1024-byte protocol limit and retained as first received boundary
latencies from adapter spawn. They neither authorize GO nor identify the current
blocked call after repeated polls. Default runtime behavior has tracing disabled.
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
