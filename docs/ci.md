# CI checks and diagnostic routes

Read when selecting or diagnosing a CI route, changing CI scheduling, or checking exact-SHA acceptance. [Development](development.md#verification) owns verification policy; [.github/workflows/desktop-ci.yml](../.github/workflows/desktop-ci.yml) owns the inherited desktop routes.
[macos-install.yml](../.github/workflows/macos-install.yml) adds macOS 14 arm64 DMG
build/install/reopen/replacement acceptance on push, pull requests and manual dispatch.
It retains exact-SHA reports/screenshots without publishing the DMG.
The issue-scoped [performance workflow](../.github/workflows/performance.yml)
packages immutable baseline `d925f8b7` and the candidate on macOS 14 and Windows
latest, then applies the same disposable 1,000-project harness. Baseline target
misses are retained; scenario, shutdown and cleanup failures remain failures.
The candidate must pass correctness and all approved limits. Artifacts contain
raw reports/screens with SHA/run/attempt provenance, without application binaries.
See [measurement boundaries](verification/issue-41-performance.md).
For a failed performance candidate step, dispatch that workflow with
`candidate_only: true` and the actual failed `platform`. `profile_filters: true`
adds a separate renderer CPU profile of the 100-to-1,000-row Board filter
transition. Profiled runs are diagnostic and cannot use `--enforce`; the original
unprofiled strict command still runs independently after its package prerequisite.
Baseline failure evidence remains retained, and ordinary push/full dispatch
defaults still measure both baseline and candidate on both platforms. A focused
success does not replace the full acceptance run on the repaired SHA.
`profile_service: true` separately profiles real public-service open, source
lists, displayed-view reads, refresh and the native observer interval using the
same disposable scale. These Node profiles diagnose backend work; they do not
substitute for the original packaged Electron command that still follows them.
The same workflow adds Windows x64 NSIS installation/reopen/reinstall acceptance
on ordinary push/PR, or independently with `checks: windows-install` on dispatch.
This runs on `windows-latest` and records its actual Windows Server version; it
does not stand in for Windows 11 desktop acceptance. Installer downloads are not
uploaded. See [Windows installation](windows-install.md).

The issue #48 `desktop-shell` focused route also replays the original development
Table/Board lifecycle after the folder-group visibility and saved-filter failures,
including their filter/removal and viewport regressions, and Windows
creation/recovery Ladle layouts after the corresponding full-run failure.
Its original assertions and exact-SHA artifact remain required; the broader
ordinary platform matrix is unchanged.

For #48's remaining macOS final-workspace-removal navigation failure,
`checks: shell-runtime` runs the original macOS development runtime with App
removal, readiness, lifecycle and routing regressions, serial Electron setup,
strict build gates and exact-SHA evidence. Earlier authoring, Windows MultiSelect
and category-cache failure results remain in the issue's verification report;
their ordinary/full tests and native commands remain registered. Their resolved
Windows focused commands are not replayed for this macOS navigation failure.
Focused success still precedes full acceptance.

For #48's remaining Windows latest views startup failure, `checks: views-readiness`
runs only its original development Table/Board command with startup/ownership,
native drag, async path-readiness, assignment and viewport regressions. The prior
macOS and Windows 2022 drag failures retain their original passing focused evidence.
Bounded reproduction
uses three independent original journeys per host, distinct logs/evidence and
stops at the first failure. It retains the original 15-second readiness allowance,
strict failures and exact-SHA evidence; full acceptance follows only after the
original commands pass. Native drag endpoints are scrolled into view before
mouse-down; automatic scrolling during the gesture is disabled, without replaying
a mutation or replacing its result assertions.
As in the ordinary suite runner, its build prerequisite completes Electron's
lazy installation serially before parallel native regression workers start.

For #48's Windows latest early direct-creation Reveal failure, use the existing
`checks: readiness` route with `readiness_reveal_windows`, `readiness_native_windows`
and `readiness_native_early` enabled. That combination selects only Windows latest
and the original cold direct-creation/native command before related Reveal controls.
Enable `readiness_native_trace` to retain the existing finite bridge phases for
the observed opened/owner-deadline rejection. Deadlines, native selection,
binding/permit guards and cleanup assertions remain unchanged; trace evidence
alone does not establish a repair or acceptance.

## Candidate and handoff

Subsequent #47 UI work after #52 follows the owner-approved
[desktop UX selection matrix](desktop-ux-verification.md). Bounded UI changes
require visual and affected-behavior evidence; broad acceptance runs at its
integration milestones or when the affected boundary calls for it. This overrides
blanket application-change/full-rerun wording for that scope only. The actual
workflow defaults below remain broad until a verified scoped route is implemented;
the policy does not turn a skipped check into evidence or change #52's live gates.

The acceptance renewal policy below governs all focused routes in this document. Historical route notes requiring a subsequent full run describe the default; eligible test-only repairs use [evidence reuse](#evidence-reuse-after-test-only-repairs) instead. Ordinary push/PR and explicit full workflow defaults remain unchanged.

Use the [implementation sequence](development.md#implementation-sequence) before dispatching candidate acceptance. The candidate includes application changes, tests, fixtures, CI routes and relevant repository reports. Record observed local results before committing it; keep pending CI/integration status in the GitHub issue checkpoint linked from the plan.

After acceptance, record the run/attempt, tested SHA, actual checks/artifacts, delivered SHA and integration verification in that checkpoint. A fast-forward delivery of the same commit retains exact-SHA evidence. If a required later change creates another commit, identify its affected boundary and renew the checks it requires; state explicitly when a documentation-only change has separate checks rather than describing its SHA as platform-tested. Preserve existing workflow defaults and required platform coverage.

For #49's sidebar switching and source-setup focus repairs, `checks: workspace-sidebar`
runs the original `npm run smoke:shell` and the focused `smoke:workspaces` native
journey on macOS latest, Windows latest and Windows 2022, with their build and
related workspace/routing regressions. The
failure was an ambiguous name selector matching both workspace selection and the
new contextual-actions button. Exact-name selection retains saved-view and
restart/focus assertions. Setup postponement now returns focus after its preview
trigger is enabled, including delayed-preview rejection. This focused route retains SHA/run/attempt artifacts;
its success precedes a full acceptance dispatch on the same repaired SHA.
Ordinary platform coverage remains unchanged. Workspace-management artifacts are
required after an attempted management step; an earlier skipped step has no
management evidence to upload.

For #49's later Windows 2022 management/Apply failure, `checks: workspace-setup`
selects only Windows 2022, the original `npm run smoke:workspaces`, and its
keyboard-readiness/route regressions. The other two management targets and all
original-shell targets retain their passed evidence. The driver waits for an
enabled reviewed Apply before one Enter, retaining the caller deadline and
original project/persistence assertions. Focused success and artifact inspection
precede renewed full acceptance on the same SHA. For the subsequent fixture-only
preparation timeout, `checks: workspace-setup-readiness` runs only the failed
readiness fixtures and route tests; the original Windows 2022 native journey
already passed in run 39376901213 and retains its separate evidence. Fixture
preparation has its existing 30-second budget; the 1,000-ms keyboard action and
100-ms negative action deadlines remain unchanged.

## Failed Actions loop

For issue #41's macOS/Windows development runtimes waiting for offscreen project cells,
dispatch the desktop workflow with `checks: viewport-runtime`. It runs only
the three affected platforms, the viewport/rename/category driver regressions and the original
`npm run smoke:runtime -- dev` command with its existing deadlines, layout,
data-preservation, native and shutdown assertions. The driver scrolls to the
owned project identity before expecting its real fields. It never accepts a
placeholder as a cell. Exact-SHA evidence is retained; unrelated raw-rename and
observer CLI diagnostics are not selected. Full acceptance follows focused
success on the repaired SHA.

Apply this loop automatically when a GitHub Actions check fails during an authorized task, including continuation in a new window. The agent invokes `diagnosing-bugs` without requiring another user command. Executor selection remains governed by [development](development.md#executor-selection); CI failure does not select Ralphex. Continue within existing implementation/push/Actions authorization; request only genuinely missing access or consequential decisions.

1. **Retain the failure.** Record the run/attempt, exact SHA, failed check, OS, original command and relevant logs/artifacts. Distinguish a failed check from a cancelled run, skipped stage or unavailable evidence.
2. **Diagnose and repair.** Follow `diagnosing-bugs`: build a red-capable reproduction, test falsifiable hypotheses, make the scoped repair and verify a meaningful regression. If original evidence cannot identify the cause, retain that limitation and add bounded diagnostic evidence instead of claiming causation or retrying unchanged inputs until green. Preserve product assertions, deadlines, ownership and cleanup gates.
3. **Run only the affected failed checks.** Map the actual failures to focused commands on the affected OS, with necessary build/fixture prerequisites and relevant repair regressions. Select an existing manual route only when it matches those failures. If no matching route exists, add or narrow one before dispatch; the historical route names below are not a generic list to replay. Do not substitute an entire full suite for an addressable failed step. A rerun of an old failed run tests its old SHA, not the repair.
4. **Keep full CI behind the focused gate.** While preparing repair commits, use the repository's supported push-CI suppression (`[skip ci]`) and explicitly dispatch the focused route for the repaired SHA. Keep ordinary workflow defaults intact. Inspect the original focused command's result and required artifacts; diagnostics alone, missing evidence, skips and unreached stages do not pass this gate. A new focused failure returns to diagnosis.
5. **Renew acceptance after focused success.** Once every affected failed check passes and its evidence is inspected, classify the complete diff from the earlier tested candidate. For eligible test-only repairs, follow [evidence reuse](#evidence-reuse-after-test-only-repairs), running affected consumers and any missing scenarios. For application/build/dependency changes or an uncertain impact boundary, dispatch full acceptance on the reviewed SHA after coordinated pushes finish. A new failure returns to step 1 with its failure map.
6. **Deliver only with complete passing coverage.** Inspect required artifacts and apply the existing acceptance/integration policy. Every required scenario/platform needs either current passing evidence or explicitly justified inherited evidence. Focused success alone is insufficient; report each actual tested SHA separately from the delivered SHA.

Keep the current SHA, failure map, reproduction/repair evidence, focused run/result, full run/result and next unresolved gate in the task's existing checkpoint. On a new window or context reset, read that checkpoint and verify the current branch/SHA and run status before continuing from the unresolved gate. Do not default to full CI or replay completed gates merely because the conversation restarted; code changes or new failures determine which evidence needs renewal.

### Evidence reuse after test-only repairs

Select required scenarios under the [inherited coverage policy](development.md#inherited-test-coverage), then run broad acceptance on the completed application candidate. After a repair confined to tests, fixtures, smoke drivers, diagnostic workflow routes or documentation, reuse successful evidence only when all of these conditions hold:

1. Review the entire diff between the source receipt's SHA and the candidate, including intermediate commits. Establish unchanged application, migrations, native resources, dependencies/lockfile, build/package inputs and relevant runtime configuration. A filename classification alone is insufficient; scripts and CI can affect the built application or execution environment.
2. Map each changed test/helper/fixture/route to its consumers and required OS/runtime modes. Renew those checks on the candidate, including the original failed command and repair regressions. A shared helper change expands the consumer set. Validate changed CI routing and suite registration; retain assertions, deadlines and required platform coverage.
3. Retain only successful, inspected receipts with available logs/artifacts and matching relevant inputs, command, runner/toolchain and scenario. A failed overall job may contribute individually successful steps with independent complete evidence. Failed, cancelled, skipped, unreached or missing-evidence scenarios remain unresolved; run them with their prerequisites. A later contradictory failure reopens the scenario even if an older run passed.
4. Record a compact acceptance ledger in the existing GitHub checkpoint: scenario/command and OS/mode; source SHA/run/attempt and artifact; inherited or renewed status; unchanged-input justification or repair result; remaining gates. State which application inputs were compared and which consumers were renewed. Never relabel old receipts as tests executed on the new SHA.

When every required row has passing evidence, acceptance may combine runs without another full matrix. If impact or evidence is uncertain, run the affected broader boundary; use full CI when it cannot be bounded. Release-specific acceptance and agreed human gates still apply. Documentation-only follow-ups require documentation checks and inherit runtime evidence under this same rule.

Use supported `[skip ci]` commits and explicit focused dispatch for eligible follow-ups; retain ordinary workflow defaults. Add a bounded route for affected or unreached commands when existing selectors cannot run them. Inspect an already-running full job before cancelling: allow it to finish if it is providing missing evidence, and retain any new failure for diagnosis. This policy changes acceptance decisions, not GitHub status conclusions or required branch-protection checks; any enforced gate remains required until separately changed with authorization.

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

## Issue 39 Windows Date creator failure

The installation workflow also provides a focused original-step replay for full
run `39200366181`'s Windows latest development Date failure. Dispatch
[macos-install.yml](../.github/workflows/macos-install.yml) with
`checks: windows-date`. This builds on Windows latest, runs existing real-Electron
creator and Date service/UI/route regressions, then the original
`npm run smoke:date -- dev` even after a regression failure if the build passed.
Strict command exits and exact-SHA/run/attempt evidence remain. The default
`checks: macos` retains macOS 14 arm64 installation; ordinary/full desktop coverage
is unchanged. Focused success precedes renewed full desktop acceptance on the
same reviewed SHA. The reproduced disabled-button mechanism does not independently
establish the historical activation timing, which the original failure did not record.

## Issue 48 desktop shell launch geometry

Full run `39298961435` at `719adbe` failed the new shell journey on macOS latest
and Windows 2022 before its renderer-size scenarios. The original assertion
incorrectly demanded a 1024x720 content viewport; #47 specifies a minimum window.
Retain those result artifacts (content 1024x645 and 1008x689 respectively), the
unreached ordinary platform suite and its secondary missing-collector failure.
Neither unreached steps nor secondary validation count as passing acceptance.

The repaired product uses default/minimum outer dimensions of 1024x720. The
original native journey records outer/content bounds, minimum, display/work area
and scale factor before asserting the initial outer window. An undersized native
window still fails explicitly; the two 1024x720/1440x960 renderer journeys are
unchanged. Geometry failure no longer masks already-established process ownership
and safe cleanup.

Dispatch `desktop-ci.yml` with `checks: desktop-shell` for this failure. It builds,
runs affected settings/App/route regressions and the original `npm run smoke:shell`
on macOS latest, Windows latest and Windows 2022. The original runs after a failed
regression when its build succeeded; strict exits, exact SHA/run/attempt provenance
and always-uploaded results remain. Inspect native geometry, original journey and
cleanup before full CI on the same reviewed repair SHA. Ordinary/default coverage
is unchanged.


## Issue 49 packaged Single Select readiness

Full desktop run `39381220528` at `99584863` passed Common, all platform suites,
and complete macOS/latest and Windows/2022 acceptance. Only Windows/latest's
`npm run smoke:select -- release` failed waiting for Property name after keyboard
creation. The failed screenshot showed the workspace without a property form;
normal shutdown and owned cleanup passed. The enabled state at activation was not
captured, so the historical timing cause remains an inference.

Dispatch `checks: select-readiness` to build and package on Windows/latest, run the
real-Electron EN/RU creator readiness regressions and routing checks, then replay
that exact packaged command. Enabled-button keyboard activation reuses the
existing property driver; all original action deadlines and scenario assertions
remain. Always-uploaded evidence records SHA/run/attempt and the original result.
Inspect focused results before renewed full desktop acceptance on the same SHA.
Application and installer inputs are unchanged by this driver/fixture/CI repair;
retain their separately recorded successful exact-SHA receipts.

For #50's canonical-path fixture mismatch, `checks: source-fixture` renews the
source settings renderer/service scenarios on Windows 2022, Windows latest and
macOS after their required build. The original Windows 2022 log distinguishes
legacy short-path expectations from the native canonical path displayed by the
application. This route preserves original assertions and captures exact-SHA
provenance. Apply the evidence-reuse policy to this test/route-only repair; source
native and installer receipts retain their actual earlier SHA.

After #50's original source-fixture gate passes, `checks: source-runtime` supplies
only the Windows 2022/latest layout, development-runtime and packaged-runtime
steps that the failed platform batch never reached. It builds fresh inputs and
retains the ordinary suffix's commands, environments, conditions, deadlines and
artifacts; a parity regression guards that boundary. Earlier successful platform
cases, source/shell/management journeys and installers retain their own SHA.
Windows latest's early direct native receipt is inherited; Windows 2022's later
direct native step remains in the continuation. This route neither reruns macOS
nor replaces any missing Windows scenario with inherited success.


## Issue 51 clipped Board readiness

For performance run `39414634270` at `23c7fb4`, renew only the candidate on the
failed hosts with `performance.yml`, `candidate_only: true`, `platform: both`.
A real-Electron readiness regression precedes the unchanged strict measurement;
the original still runs after a failed regression if packaging succeeded. The
readonly predicate intersects ancestor clipping boxes while retaining complete
ordered membership, pending rejection and real fields for partially visible rows.
The observed clipped-row mechanism explains the readiness deadlock, not the
separately retained startup/filter/assignment target misses. All original limits,
normal shutdown and owned cleanup remain. The original desktop and installer
runs retain their own SHA; apply evidence reuse only after reviewing unchanged
application/build inputs and inspecting every missing or renewed receipt.


After readiness renewal `39416296014`, retain the inspected macOS 14 strict
receipt at `cfefb0f7`; only Windows latest failed startup/filter timing. Dispatch
`platform: windows-latest`, `candidate_only: true`, `profile_service: true` to
retain a separate public-service diagnosis followed by the original unprofiled
strict command. Historical failures remain evidence, and profiling is not
acceptance. The runtime activation helper supports both the current tabs and the
immutable baseline select with one action and no replay; its native regression
renews both control paths without changing measured targets or application inputs.


Windows renewal `39418142493` at `420158b2` completed all functional/lifecycle
checks and startup/memory targets, but five interaction samples still exceeded
300ms. The separate service profile completed; displayed-view reads were
23.6–36.8ms, while configured-source opening/listing/refresh and native observation
also consumed CPU. This does not identify the renderer interaction delay.
The opt-in `profile_filters` diagnostic now additionally captures the first Table
filter and each Table/Board grouping-assignment span. The existing Board widening
profile is retained; all profiled measurements remain diagnostic, and the original
unprofiled strict command runs independently. An explicit Windows dispatch with
`candidate_only: false` also provides the immutable baseline's original select
consumer as a differential control; baseline target misses are recorded, not waived.


The subsequent endpoint repair captures interaction completion inside the final
existing renderer frame, retaining both readiness checks and both frame pairs.
It records the old late-read observation and trailing driver delay separately;
finite/fresh timestamp guards reject invalid measurements. Native regressions
prove delayed rendering remains measured, later driver delay does not move the
endpoint, and invalidated fields require the second readiness check. Renew only
the candidate plus these controls on both performance hosts; earlier performance
receipts retain their old clock and SHA. The original `--enforce` command and all
limits/correctness/lifecycle gates remain; desktop/installer inputs are unchanged.


For `39422590498`'s remaining macOS Table assignment and Windows interaction/scan
misses, renew both original strict candidate hosts after the in-renderer
stabilization repair. It retains both complete readiness observations and both
frame pairs within one renderer promise, records phase timestamps, and removes
only driver round trips between those phases. Fixture setup uses its ordinary
30-second budget; 500ms activation controls remain. A performance-only language
adapter preserves the immutable baseline's inline select without changing the
shared current settings driver. The failed baseline General-tab comparison remains
failed diagnostic evidence; neither its target misses nor unreached cases are
relabeled as passing current acceptance.


After `39424627943`, macOS 14 strict acceptance at `b77d3885` is inspected/passing;
only Windows latest remains failed. Observation-start metadata leaves the endpoint
and readiness algorithm unchanged, while expected-ID preparation now occurs before
the event as the contract requires. Retain the actual macOS receipt with that
unchanged-input/conservative-bound justification and renewed native controls.
Select Windows only with `candidate_only: true`, `profile_service: true`; the
separate diagnostic now includes actual filter/grouping saves and group assignment,
then the original unprofiled strict command runs independently. New phases split
pre-observation time from initial readiness; neither diagnostics nor local timings
substitute for the failed Windows targets.


For `39440696066`'s remaining Windows interaction misses, the existing optional
`profile_filters` renderer diagnostic now additionally retains Chromium timeline
streams and fixed event/paint marks alongside CPU profiles. This distinguishes
native layout/paint, JS/GC and idle spans; data loss rejects and collection has a
bounded completion/owned cleanup path. Marks/tracing execute only in the diagnostic
branch. Select Windows candidate-only with `profile_filters: true`; the unchanged
unprofiled original follows independently. Retain actual macOS `b77d3885` strict
acceptance and the separately inspected desktop/installers. No trace or isolated
service timing substitutes for a Windows strict pass.

## Issue 52 failed-host renewal

The original `350293cc` run missed macOS Table grouping/assignment targets and
Windows latest's category fixture failed before its injected cleanup checkpoint
(`grouped.restart`, `stop_owned_timeout_stopped`). These are separate gates.
Retain the actual failed artifacts and first-failure codes; a later control's
expected failure cannot stand in for reaching it. The fixture exit assertion now
includes only its already sanitized finite diagnostic/count/cleanup evidence.

The separate existing `profile_filters` performance run optionally observes main
IPC request/reply times for four fixed grouping/projection command types, bounded
to 256 records, and native window focus/visibility/minimized state. It retains no
payload, reply, exception, path or PID. This helper is installed only in diagnostic
runs; the original unprofiled strict command, endpoint, clocks, deadlines and
limits remain unchanged. Wall time correlates events; duration uses a monotonic
clock. Diagnostic results cannot substitute for strict acceptance.

Use existing `checks: category-fixture` with `category_fixture_only: true` for the
failed Windows latest original fixture file. After its focused gate passes,
`checks: source-runtime`, `source_runtime_platform: windows-latest` renews the
unreached development/packaged routes on that host. The default `all` preserves
both Windows hosts; ordinary three-platform push/full acceptance is unchanged.
The early direct Windows latest creation and shell/management/source steps that
already passed retain their actual inspected receipts; this route retains the
existing exclusion of that duplicate early direct scenario.

Apply evidence reuse only after reviewing the complete delta: these diagnostic,
assertion-message, selector/test and documentation changes do not change the
application, dependencies, migrations, native resources or build/package inputs.
Retain installer/unaffected full-platform results at their actual source SHA;
renew changed diagnostics/native controls and the failed/missing consumers.

The same original Windows performance run later timed out after resetting Table
grouping and search. Its reset driver could press an HTML-disabled Save while a
new projection was pending. A native delayed-enable regression reproduces the
lost action (zero submits, filtered rows) and passes when the original single
Enter is prepared against an enabled/focused control. Only this unmeasured reset
precondition changes; event-to-paint measurements and membership/readiness checks
remain intact. This establishes the driver race, not the unique cause of the old
hosted timeout. A failure-only readonly packet now records expected/actual row
counts, mismatch index, unloaded/pending/group counts and Save/search booleans;
it retains no IDs/text/paths and never substitutes for the original timeout.

The `c09a0505` Windows renewal completed all 32 performance scenarios, including
reset/full projection, but still missed strict targets. Its eight native driver
controls failed at normal Electron shutdown. Select `performance.yml` with
`readiness_only: true`, `platform: windows-latest` to renew only these original
controls with bounded quit-event/debugger-wait/exit evidence. This route skips
packaging, baseline and strict performance; it cannot supply performance acceptance.
Ordinary workflow defaults and the independent strict command remain unchanged.
Do not infer a repaired native lifecycle from a functional assertion or forced exit.

The isolated Windows controls then passed 10/10 at `87e63246`, run `39460699645`;
no fixture shutdown logic was changed and the historical timeout cause remains
unproven. The next optional profile records request timings for assignment,
filter saves, Text saves, snapshot reads and refresh as well as grouping/view
reads, after every measured UI endpoint. This distinguishes backend time from
renderer/driver time in the actual remaining failures. The fixed allowlist,
256-request history, privacy boundary and diagnostic-only installation remain;
original strict clocks, actions, endpoints and targets are unchanged.

For investigation without unchanged strict reruns, `diagnostic_only: true` skips
baseline and strict acceptance, requires at least one selected `profile_filters`
or `profile_service`, and uses a separate platform-specific concurrency group.
It still packages the exact candidate, retains the original native controls and
runs selected profiles. It cannot supply strict acceptance. Defaults preserve
the existing original full/candidate routes and their limits.

At `30b502b4`, strict run `39463627765` passed macOS but Windows still missed
interaction limits. Both exact artifacts were inspected: all 32 functional cases,
normal application quits/backend exits and cleanup completed. Windows separate
profiles observed assignment IPC up to 268.8 ms and filter save 126.2 ms, after
the redundant property reads had been removed. Preserve the actual macOS strict
receipt; no unchanged Windows strict rerun is selected for diagnosis.

For that remaining failure, `diagnostic_only: true`, `platform: windows-latest`,
`profile_filters: true`, `profile_backend: true` instruments only the disposable
profile bundle copy. Its archive is extracted, the pinned backend factory is
wrapped once and the diagnostic backend hashes are recorded. The original package
and strict route remain untouched. Backend observations retain fixed request types,
wall/CPU durations and timestamps, capped at 256 per process; no payloads, replies,
errors, authored values or process identities are recorded. Each normal close
flushes one batch to a new evidence file; missing batches fail diagnostics. CPU
usage includes backend worker threads and is not a main-thread CPU measurement.
Compare backend execution start/end with the main IPC interval to distinguish
service work from queue/transport delay. This modified copy cannot supply startup,
package or strict performance acceptance. Conflicting modes/missing renderer
profiling are rejected before execution.

Windows backend diagnostic `39466360777` at `80a9640f` completed 32 scenarios,
four normal backend batches/178 requests and cleanup. A slow grouped Board
assignment spent 143 ms before backend execution, 42 ms executing, and about
8 ms returning; an unmeasured preceding ordinary queryView spent 1.8 seconds
walking the source. This identifies queue delay in that diagnostic sample, not
a unique cause for every older strict failure.

The next driver repair replaces repeated metadata-only unmeasured filesystem
queries with the existing displayed-source projection derived from a public
complete source list. The service still validates its revision/full ownership
and reads current values/filter/group/layout state; stale input fails without
fallback. Initial source verification and post-filesystem-change/Refresh/identity
checks retain their ordinary fresh reads. No measured action, clock, readiness,
correctness assertion or limit is removed. Renew both original strict consumers
because preparation changed on both hosts; modified-copy diagnostics are not
acceptance and earlier receipts keep their actual SHA/harness provenance.

The issue-52 copied backend probe also records fixed internal reconciliation,
direct/grouped scan and workspace-load phase durations. These
nested spans share the bounded payload-free service history and normal-close
batch; they never authorize or replace a scan, result or request. Exact pinned
function markers and copied-artifact child execution are verified. This separates
otherwise unexplained pre-request queue time from service execution; no original
application or strict package is instrumented.

For issue-52 serial endpoint polling delay, the performance readiness predicate
also checks the operation's committed result DOM before its original frame pairs.
Observation starts before retained role-locator waits. Saved group heading and
destination membership, actual edited text and external rename remain required;
all later locators and public-service/filesystem assertions still execute. Native
controls cover delayed commitment and late driver delivery. Both strict hosts
must renew after this shared measurement-driver repair; a passing diagnostic
profile does not satisfy acceptance or establish a backend queue repair.

For the remaining issue-52 focused macOS first-group frame gaps, the separate
renderer profile accepts `profile_unthrottled: true` (CLI
`--profile-filters --profile-unthrottled`). It records original/current native
background throttling and renderer visibility/focus at the event and observation.
Only this explicit diagnostic changes scheduling; default/strict launches never
set it, and CLI enforcement rejects profiled execution. Native property and
pre-fixture CLI guard controls cover the distinction. The altered configuration
cannot supply performance acceptance or justify a production runtime change by
itself. Retain the original normal-scheduling failure for comparison.
