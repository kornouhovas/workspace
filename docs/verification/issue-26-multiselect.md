# Issue #26 verification

Contract/scenarios: [implementation plan](../plans/issue-26-multiselect.md).

## Local evidence

- macOS with Node 22.21.1, temporary real SQLite databases and disposable source folders only.
- Initial public service and Table tests failed on unsupported MultiSelect creation and absent creation control, then passed after implementation.
- Focused service/IPC/EN/RU UI tests pass: stable sets, duplicate/foreign/type/extra-field rejection, source isolation, no-op ordering, shared options, local visibility, failure rollback, pending controls, retained drafts and sibling updates. Sparse arrays initially returned storage errors; a red regression now verifies rejection as invalid input before persistence. Existing Single Select scenarios remain passing.
- `npm run test:migrations`: 346 tests, 345 passed, one platform skip, zero failures. The first run found six stale migration-count/schema-inventory expectations; only the new count/table and typed rejection expectations were updated, retaining preservation and rejection assertions.
- Typecheck, lint, documentation links and whitespace checks passed on the local candidate.
- Development Electron smoke passed EN/RU with keyboard, invalid drafts, options/colors/order, hidden usages, multi-membership save, restart, clear, individual removal, source-sibling edits, stable project ID and unchanged folders/files. 1024/1440 captures show no page overflow; the narrow RU capture was visually inspected. Local evidence: `work/issue-26-multiselect-runtime/`.
- macOS package build and artifact check passed. The first packaged smoke completed English acceptance and encountered a 10-second ordinary-quit timeout during the Russian restart. Owned forced termination and cleanup passed, but that is a failed shutdown gate. Retained evidence: `work/issue-26-multiselect-package/`. The bounded event-instrumented run then passed EN/RU and all three normal quits with `before-quit`, `will-quit`, `quit`, parent exit, backend exit and fixture cleanup. This does not establish the cause of the first timeout.
- After the review's hidden-option locator correction, both development and packaged macOS smoke routes passed again at the original deadlines, with complete EN/RU assertions, all three normal quits/backend exits and fixture cleanup. Corrected evidence: `work/issue-26-multiselect-dev-reviewed/` and `work/issue-26-multiselect-package-reviewed/`. The packaged English wide capture was also visually inspected.

## Standards review

The independent reviewer found zero documented-standard violations and one optional possible duplication smell: the MultiSelect and scalar cell editors each retain their small editing-lifetime, revision and focus flow. The distinct controls remain separate; the paired behavioral suites cover both. This is a nonblocking judgment call, with no demonstrated defect.

## Spec review

The independent reviewer found no product-contract violation or scope creep. It found one nonblocking smoke precision issue: filtering checkbox inputs by text cannot prove their absence. The check now uses the exact localized accessible name. The reviewer confirmed the repair, and both original development/package routes passed afterwards. Existing EN/RU interaction tests independently check the hidden-unassigned behavior.

## Final local suite

Before the first CI run, `npm run test:all` passed on the reviewed implementation/test/runtime candidate,
reusing the unchanged final application build: 2834 tests, 2811 passed, zero failures,
23 platform/conditional skips, 151.5 seconds. Typecheck, lint, documentation links and
whitespace checks also passed after the review repair. No production assertion,
shutdown deadline, platform route or cleanup gate was relaxed.

Implementation and the initial review baseline are committed as `63f2be03`; the follow-up
commit records the reviewer-confirmed smoke assertion correction and these observed
results. Current exact-SHA CI and integration receipts are tracked in [GitHub #26](https://github.com/kornouhovas/workspace/issues/26).

## Delivery gates

The owner explicitly authorized publishing #26 to the current public repository, its GitHub checkpoint, CI and successful integration into `new-workspace` on 2026-10-15, resolving the issue-specific publication gate under [tracker policy](../issue-tracker.md). Exact-SHA platform CI, artifact inspection and integration acceptance are recorded in the GitHub checkpoint; local macOS evidence alone cannot establish Windows acceptance. This authorization does not publish a release or change the repository-wide default policy.

## First exact-SHA CI and property-creator repair

Full run [38727412661](https://github.com/kornouhovas/workspace/actions/runs/38727412661),
attempt 1 on `e40b0c151818aca444f925d1c26ceec5849d44c2`, passed common checks and
both complete Windows jobs. The sole failure was macOS's original
`npm run smoke:multiselect -- release`: a 15-second `Property name` locator timeout.
The macOS platform tests, development MultiSelect, package build/resource check had
passed. Its retained artifact 11969832549 shows no created property/form and zero
completed language checks; normal quit, backend exit and cleanup passed. This is
separate from the earlier local shutdown timeout.

A controlled real-Electron disabled-button fixture reproduced the same lost Enter
symptom with the original focus/press driver (red: property-name input absent).
The driver now resolves the same accessible button together with native `:enabled`
before focus and a single keyboard activation, under the caller's original timeout.
The initial enabled operand is retained in new runtime evidence. The original CI
artifact lacks that initial operand, so this reproduction establishes a faulty driver
path without proving the exact original scheduler/focus cause.

The new isolated real-Electron driver file verifies delayed enablement, one activation,
property-name entry and rejection without activation when loading never finishes.
It passes with the repair, and the original packaged EN/RU smoke passes locally with
normal quit/backend exit and cleanup. During regression preparation, an invocation
using the existing rename suite stalled after its host-clock cases and was terminated;
it is not counted as passing evidence. The new tests use a separate process/fixture
and existing bounded strict quit helper; the original rename test file is unchanged.

`checks: multiselect` selects only the original failed macOS route with build,
related driver/MultiSelect regressions, package/resource checks and exact-SHA runtime
artifacts. Original product assertions, keyboard editing, timeouts and cleanup gates
are retained. Current repair review, focused CI and renewed full acceptance receipts
belong to the GitHub checkpoint.

### Reviewed repair and renewed local acceptance

The two independent reviewers checked `e40b0c1...aa6a107`. Spec reported no findings;
Standards reported no hard/blocking findings and suggested retaining secondary cleanup
errors in the isolated fixture. Those errors are now logged while the primary failure
remains primary; the Standards reviewer confirmed the change, with no remaining
actionable findings. Existing rename fixture/tests are unchanged.

After this repair, typecheck, lint, documentation links and focused routing/native/UI
checks passed (49 tests, zero failures). The original packaged EN/RU MultiSelect command
passed locally with normal quit/backend exit and owned cleanup. A renewed complete
`npm run test:all` on the final reviewed source/test candidate passed: 2837 tests,
2814 passed, zero failures, 23 conditional/platform skips, 137.7 seconds. It reuses the
unchanged verified application build because the repair affects the acceptance driver,
regressions and CI routing, not application behavior or persistence. Current focused
and full exact-SHA CI receipts remain in the GitHub checkpoint.

## Second full CI: Windows latest ownership gate

Focused macOS run 38731833753 passed on `0335f0f5955a23a15d2ed64738c6693e8d029e0c`;
its exact-SHA/run/attempt artifact 11970566654 was inspected. All 35 regressions and
original packaged EN/RU assertions passed, including three normal quits/backend exits
and owned cleanup. Russian creation entered with an initially disabled button and
passed through the repaired readiness path.

Renewed full run [38732178491](https://github.com/kornouhovas/workspace/actions/runs/38732178491),
attempt 1 on that same SHA, passed common, complete macOS and complete Windows 2022
jobs. MultiSelect development/package passed on all three platforms. The sole failure
was Windows latest's final `npm run smoke:runtime -- release`, in category-move fixture
cleanup: owned-process termination was unverified, so removal was correctly skipped.
Artifact 11974065540 records all 34 normal quits/backend exits passed and no failed
shutdowns, but lacks the final ownership predicate. This does not prove PID reuse,
a live owned process or the exact source of uncertainty.

The category fixture now retains the same sanitized `inspectOwnedProcesses` result
already used by the rename fixture (finite reason/counts, no PIDs/paths/raw errors).
Its `stopped` value is the original boolean gate; no guard, deadline, cleanup restriction
or scenario assertion changes. The existing `checks: windows-release` route matches
the exact failed OS/command and adds the affected category runtime regression file.
The original failed CI command is the red-capable remote reproduction; a new diagnostic
candidate is needed because the historical artifact cannot distinguish the three
ownership hypotheses. Current review/focused/full receipts remain in GitHub #26.

### Reviewed diagnostic candidate

Both independent reviewers checked `0335f0f...118c21e` and reported no findings.
Typecheck, lint, documentation links, whitespace and 101 focused lifecycle, startup,
category and CI-route tests passed. The complete local suite on the reviewed candidate
passed: 2837 tests, 2814 passed, zero failures, 23 conditional/platform skips,
127.8 seconds. The diagnostic does not change application behavior or the existing
process-ownership decision; exact-SHA Windows reproduction and subsequent full
acceptance remain required and are recorded in the GitHub checkpoint.

## Third full CI: Windows latest ETW control

Focused Windows release run 38737119214 passed on `76cc1ac41cecf07084fddd5e5c328b8849d4be04`;
artifact 11973748466 was inspected. Category ownership was `confirmed`, all 34 normal
quits/backend exits and asserted fixture removal passed. This does not prove the
historical ownership failure's cause.

Full [run 38738171579](https://github.com/kornouhovas/workspace/actions/runs/38738171579),
attempt 1 on that same SHA, passed common checks and complete macOS/Windows 2022
jobs. Windows latest's platform suite had one failure:
`tests/windows-rename-etw.test.mjs`, owned ETW attribution/retention controls. Its
PowerShell child rejected after 10.9 seconds; TAP preserved the command but omitted
exit/signal/killed/stderr operands. Later Windows latest runtime/package stages were
unreached, so they are not accepted. The original job log is retained locally;
collector artifact 11974931622 is supplemental observer evidence, not an ETW verdict.

The original Windows test is the red-capable remote reproduction. Its existing
ten-second limit and assertions are preserved; finite error phase, duration,
killed/signal/code and recognized-error markers distinguish child timeout/exit,
native precision setup and filter hypotheses. The new `checks: etw-controls` route
matches the actual Windows latest file without replaying unrelated historical
diagnostics. Exact-SHA review, local checks, focused artifact and renewed full
acceptance receipts remain in GitHub #26.

### Local native fixture failure during ETW preparation

The first renewed local full suite had 2838 tests: 2813 passed, two failed,
23 skips, 126.1 seconds. Both failures were the new property-driver fixture's
10-second Electron shutdown guard after its page assertions, not the ETW test
(which is Windows-only). This run is not accepted. The original log is retained
locally as `work/issue-26-ci/local-full-etw-failed.log`.

The fixture now captures only finite normal-quit/parent-exit markers and existing
forced-cleanup outcome on failure; original close helper, timeout and assertions
are unchanged. An isolated run of both original property tests passed, but cannot
prove the historical cause or replace a renewed full run. Transport completion,
actual process shutdown and unfinished page work remain distinct hypotheses.
Current review and renewed full acceptance receipts remain in GitHub #26.

The diagnostic full renewal also failed (2838 tests,2814pass,1fail,23skips,
118.1 seconds): the never-ready property test captured all three normal quit
markers but required forced parent cleanup. It remains failed; markers alone
do not establish normal process exit. The local log is retained as
`work/issue-26-ci/local-full-etw-quit-failed.log`.

Inspection of the installed Playwright implementation confirms that its
`app.close()` already owns `app.quit()` and debugger disconnection. The property
fixture now calls that close operation once under the same ten-second bound,
instead of preceding it with the general helper's concurrent quit request.
The existing exit assertion/profile-removal gate remain. After a normal-close
failure, the general helper is used only for bounded owned-process cleanup;
the original failure is always rethrown. This narrowly tests the double-request
hypothesis without changing production/runtime helpers or accepting forced exit.
The original full property tests remain the native regression; exact historical
scheduler causation is not claimed.

The focused selector also includes an independent macOS job for the original
property-driver file after this local failure. Both failed seams now have an
OS-matching original-file gate and exact-SHA/run/attempt output before full CI.
Focused local property/route checks passed: 27 tests, zero failures.

### Reviewed native candidate and renewed local acceptance

Both independent review axes reported no findings for the ETW diagnostic and
subsequent property-fixture repair/focused routes through `51e72ca0`. Typecheck,
lint, documentation links and whitespace checks passed; 27 focused property/route
tests passed. The complete local suite on the final reviewed candidate passed:
2838 tests, 2815 passed, zero failures, 23 conditional/platform skips, 118.2 seconds.
This renews local acceptance without erasing the retained failed runs or proving
the exact historical scheduler cause. Windows ETW and macOS native focused evidence,
then full exact-SHA platform acceptance and integration remain GitHub gates.

## Fourth full CI: Windows latest creation shutdown

Both native focused gates passed on `cedb3362d28fda80de36bab73088d5574e354870`
in run 38761311867 (artifacts 11985298886 and 11984969411 inspected). Full
[run 38761764716](https://github.com/kornouhovas/workspace/actions/runs/38761764716),
attempt 1 on that SHA, passed common checks and all three platform test suites.
Windows latest job 116515421626 then failed original
`npm run smoke:runtime -- dev --creation --skip-native`: ten-second normal Electron
shutdown timeout, forced cleanup reported error 255 but parent termination was
confirmed. Artifact 11986107987 was inspected. The first direct/after_intent run
records before-quit prevented true, before-quit false, will-quit/quit false; normal
shutdown is failed. Fixture removal passed. Later matrix scenarios/runtime/package
stages were unreached and are not accepted. Other full jobs were still running
when diagnosis began; their final receipts belong to the GitHub checkpoint.

The installed Playwright close implementation owns app.quit and debugger
disconnection. A real Electron regression now reproduces the application's deferred
before-quit/cleanup shape: the original helper's competing quit bypassed that
cleanup (red, cleanupComplete false). Removing only its preliminary evaluate/quit
lets Playwright close own one request (green, cleanupComplete true). The ten-second
normal deadline, original failure, five-second owned forced cleanup and caller
backend/fixture gates are unchanged. Three Node lifecycle adapters now model the
close operation owning normal process exit; their preservation/failure assertions
remain. This proves the competing-request defect, without claiming the exact
historical Windows timeout's debugger/scheduler cause.

All 63 focused native/lifecycle/phase/route/property tests passed after adapter
reconciliation. Existing `checks: creation-shutdown` matches the original failed
Windows latest command and adds this native regression. The original command runs
independently after a regression failure when its build passed; failed steps remain
failed. Focused original result/artifact and renewed full acceptance on the same
reviewed SHA remain required.

### Creation focus observation during local reproduction

The first local original creation matrix after the quit repair passed eight
normal shutdown/backend-exit assertions, then failed the existing immediate focus
assertion when opening the grouped/after_intent form. It remains a failed run
(`work/issue-26-ci/local-creation-single-quit-failed.log`); cleanup passed.
The application focuses that input in a React effect. A real-Electron visible
input with delayed app-owned focus reproduces the one-shot assertion's failure.
The driver now observes visible input plus actual activeElement in the existing
15-second page allowance instead of checking immediately after visibility. It
never focuses or fills the input itself; the original explicit focus assertion
remains. The same native regression verifies delayed focus, unchanged contents
and timeout without acquiring focus if the app never supplies it. All 64
focused native/lifecycle/phase/property/route tests passed. The creation-focused
CI route includes this regression before its unchanged original command.

The two-axis follow-up review found one regression setup race: its 200 ms focus
timer was armed before the separate initial-unfocused IPC assertion. The test
now verifies that precondition before arming the app timer. This preserves the
behavioral control without allowing a slow runner to invalidate correct behavior.
After this repair, all 64 focused checks passed. The original local
`npm run smoke:runtime -- dev --creation --skip-native` completed all eight
direct/grouped interruption cases: 16 normal quits/backend exits and asserted
owned fixture cleanup passed. Its native API stages are intentionally skipped by
that original command and are not claimed as native acceptance.

### Final reviewed quit/focus candidate

The independent reviewers confirmed the focus-control race repair in `0b83781b`;
no actionable findings remain in the helper/focus changes. Typecheck, lint,
documentation links and whitespace passed. All 64 focused native/lifecycle/phase/
property/route tests passed; the original local creation matrix completed all
eight cases with 16 normal quits/backend exits and asserted cleanup.

The final complete local suite on this reviewed candidate passed: 2840 tests,
2817 passed, zero failures, 23 conditional/platform skips, 120.5 seconds. The
application build is unchanged; harness/regression changes are tested against it.
Current exact-SHA focused Windows creation, renewed full platform and integration
receipts remain GitHub #26 gates. Earlier failed evidence is retained.

## Focused Windows creation: native-binary preparation

Focused [run 38765621210](https://github.com/kornouhovas/workspace/actions/runs/38765621210),
attempt 1 on `f97f59dac7a656149d3678e268fefcb07871b3c7`, passed the original
creation crash/recovery command independently after its regression step failed.
Artifact 11990021114 was inspected: eight cases, 16 normal quits/backend exits,
asserted owned cleanup; native API stages intentionally skipped. The focused
gate remains failed: three property-driver tests could not launch Electron,
while the actual deferred-quit regression and other 60 controls passed.

The job log contains two concurrent `Downloading Electron binary...` messages
from separate native test workers. Installed Electron resolves its executable
by synchronously invoking installation on first require, then extracting the
shared dist directory. Concurrent cold extraction/use is the leading hypothesis;
the historical launch artifact does not prove its exact OS-level mechanism.
Fixture-specific startup or missing native resources are alternatives.

The all/platform suite runner now resolves the pinned Electron package once
before starting parallel test workers; pure common and inventory/list routes do
not materialize it. The focused creation route has the same explicit preparation
prerequisite before concurrent native regressions. Original creation remains
independent of regression outcome after build and binary preparation succeed.
No worker assertion, deadline, test inventory or runtime behavior is changed.
All 64 focused tests passed locally with sequential preparation. Exact-SHA
review, final local renewal and the focused Windows result/artifact must pass
before another full dispatch.

### Reviewed preparation candidate

Both independent review axes found no findings in `f97f59da...9fced98c`.
Typecheck, lint, documentation links and whitespace passed; all 64 focused
checks passed. The final full local suite on that reviewed source passed:
2840 tests, 2817 passed, zero failures, 23 conditional/platform skips,
120.8 seconds. Existing original local creation acceptance is unchanged.
Current exact-SHA focused Windows and subsequent full/integration gates remain
in GitHub #26; earlier failed runs and causal limitations remain retained.

## Fifth full CI: Windows latest category utility exit

Focused creation run 38767178725 passed on `f5a19f1e7c824ebb4aad2c3c5cd7300c95f4e353`;
artifact 11989247216 was inspected (64 regressions, eight original cases,16 normal
quits/backend exits, no forced cleanup, asserted fixture removal). Full
[run 38767720986](https://github.com/kornouhovas/workspace/actions/runs/38767720986),
attempt 1 on that SHA, passed common checks. Windows latest platform job
116535963218 failed only the existing reconnect/malformed-result category fixture
control, before its intended injected reconnect error. The real earlier seam was
`stop_owned_timeout_stopped`, with a later `final_stop` failure. Other jobs were
still running when diagnosis began; final receipts remain in GitHub.

Artifact 11989409806 was inspected (41 JSON checkpoint files). The failed control
kept the actual primary error: utility exit notification missed its existing
one-second bound, while the final OS probe reported stopped. Its `utility_exit`
arrived after result/ack/exit_sent; supervisor eventually confirmed one utility
exit, main exit and fixture removal. This eventual cleanup does not satisfy the
earlier deadline or expected injected-connect outcome. The original full-suite
command is the red-capable remote reproduction. Delayed event delivery under
parallel native work, late backend termination and notification behavior remain
hypotheses; exact historical cause is not proven.

On Windows all/platform execution, that existing control file now runs as an
exclusive first batch before other native workers. Every selected file still runs
exactly once; a failed/signaled first batch stays failed even when later batches
pass. Common, inventory/list and non-Windows execution retain one batch. The
one-second guard, fixture and every expected diagnostic assertion are unchanged.
A scheduling control went red before isolation and green afterwards; coverage and
aggregate failure tests verify the boundary. This is a controlled scheduling
change, not proof of the historical event-delivery cause.

Use existing `checks: category-fixture` with `category_fixture_only: true` to run
only the original Windows latest file and retained checkpoint/output artifact.
The historical Windows2022 runtime route remains available under its unchanged
default flag. Review, final local renewal and focused original evidence must pass
before renewed full acceptance on the same candidate.

### Reviewed scheduling candidate

Both independent reviewers found no findings in `f5a19f1e...d2276770`.
All79 focused category-fixture/scheduling/route checks passed. Typecheck, lint,
documentation links and whitespace passed. The renewed complete local suite on
the reviewed source passed:2843 tests,2820 passed,zero failures,23 conditional/
platform skips,112.1 seconds. Local macOS execution retains the existing single
batch; this is not Windows scheduling acceptance. Exact-SHA focused Windows
original/artifact, subsequent full platform and integration gates remain in
GitHub #26.

## Sixth full CI: Windows 2022 App Reveal feedback

Focused category run 38771221477 passed51 original tests on
`f189f441e9a29f284c8d4d30d4666c1129aaa932`; artifact11991342979 was inspected.
Full [run38772058082](https://github.com/kornouhovas/workspace/actions/runs/38772058082),
attempt1 on that SHA, passed common checks and Windows2022's exclusive category
batch (51pass,zero failures/skips). Its remaining platform batch failed only the
existing EN/RU real-service App creation/Reveal/reopen test at renderer-app line3433:
after deleting the reopened folder, the expected revealMissing message was absent.
The retained job log has a truncated DOM and no final click/receipt/lifetime
operands. Windows2022 runtime/package stages were unreached. Other platform jobs
were still running when diagnosis began; final receipts belong to GitHub.

The original Windows2022 file/command is the red-capable remote reproduction.
Hypotheses: a click while reload disables the button; observation invalidating
the asynchronous response; row/message lifetime changes. The test now retains
finite language/mode, request/receipt counts (at most four typed outcome/problem
records), disabled-at-click, projection/observation counters, button count and
known message booleans when it fails, preserving the original error. No click,
wait, fixture behavior, deadline or assertion is changed. Original App/route
focused local checks passed121 tests. Local replay results and exact-SHA Windows
evidence remain in the GitHub checkpoint; local success cannot establish cause.

New `checks: app-fixture` matches only the original Windows2022 App file after
its build and route checks. The original file runs independently of route-check
failure after build succeeds, with strict pipefail and exactSHA/run/attempt output.
No existing route matches that OS/file without unrelated diagnostics. Review,
local renewal, focused original evidence and full acceptance remain required.

### Reviewed App diagnostic candidate

Both independent review axes found no findings in `f189f441...4d9417e7`.
Typecheck, lint, documentation links and whitespace passed;121 focused App/route
tests passed. Twenty filtered local repetitions of the original App case passed,
so they do not reproduce or explain the Windows failure. The renewed complete
local suite on this reviewed candidate passed:2844 tests,2821 passed,zero
failures,23 conditional/platform skips,110.8 seconds. Observation may perturb
scheduling; no historical cause or product fix is claimed. Exact-SHA focused
Windows original/artifact, full acceptance and integration remain GitHub gates.

## Windows latest native creation: first binding completion evidence

Full38775873085 / attempt1 on `315eb61f` passed common checks and all three
platform test suites; complete macOS and Windows2022 acceptance passed. Windows
latest failed the original direct development creation/native command with zero
selections instead of one. Artifact11994278158 retained one exact parent
navigation, bridge state `opened`, owner_deadline, rejected native_unavailable
receipt and confirmed bridge/Explorer/fixture cleanup. Failure cleanup does not
complete the scenario's normal shutdown/restart acceptance.

The existing matching Reveal/native route with its original UI predecessors and
trace enabled reproduced the exact failure in focused38779174513 / attempt1,
same SHA. Artifact11996460002 was inspected: all predecessors and native/service
controls passed; first received `document` boundary was6446ms, followed by owner
expiry without a received `parent` boundary. Deduplicated first-received markers
do not identify the current COM call after repeated polls, so historical cause
remains unproven. Ranked hypotheses distinguish a blocked read, readiness polling
and child-token delivery. Windows2022's226 relevant controls passed separately.

One new opt-in `binding_returned` marker records whether at least one complete
binding read returned. If absent at expiry, an initial binding read has not
reported completion; if present, the first-read stall hypothesis is falsified.
The existing private protocol remains1024bytes;18 fixed deduplicated markers fit
inside it. Tracing defaults off. There is no change to navigation, COM reads,
permit, selection, binding guards, deadlines or cleanup. The adapter control went
red before accepting the marker, then green while retaining the unchanged
owner-deadline rejection and zero permits. Actual Windows consumer controls
verify marker absence on a thrown first read and one marker on a completed read
followed by failure. These controls establish diagnostic semantics, not an
historical COM cause. Review, local renewal and exact-SHA focused/full acceptance
remain GitHub gates.

### Reviewed completion-marker candidate

Both independent review axes found one documentation overstatement about missing
trace evidence; `27ad1da` corrects it and both reviewers confirmed resolution.
There are no remaining implementation findings. Fresh build plus complete local
suite passed2845 tests:2822 passed,zero failures,23 platform/conditional skips,
113.8seconds. The139 focused Reveal checks passed with five actual-Windows skips;
typecheck, lint, documentation links and whitespace checks passed. Windows
consumer controls, original focused native command/artifact and subsequent full
CI must pass on the exact published candidate; local controls do not establish
Windows native acceptance or a historical cause.

## Native predecessor minimization and scheduling isolation

Focused38780861987 / attempt1 on `89c107a3` repeated the original zero-selection
owner expiry after all UI predecessors. Artifact11996541927 inspected: initial
binding returned1052ms, first window item2546ms, first document8520ms, no parent
marker before12sec expiry; every cleanup passed. This rules out an incomplete
initial binding read but not a later COM/read/delivery cause.

Focused38781872446 / attempt1 on the same SHA changed only
readiness_native_prefix to false. Windows latest's original native command
passed; artifact11996781130 was downloaded and inspected. One parent navigation,
one completed selection, exact-target COM/UIA agreement, acknowledgment,
restart and both normal quits/backend exits passed, with confirmed bridge,
Explorer and fixture cleanup. Document/parent first receipts were2726/5004ms,
readiness recheck6314ms. The different runs establish a useful predecessor/load
hypothesis, not causal proof about the OS actor.

Windows latest full acceptance now runs the exact direct native command just
after build, before other platform/layout/recovery work. Every other command
still runs; macOS/Windows2022 order is unchanged. A route regression went red
before this order change. It verifies exactly one execution on each OS, retains
every later original workload and forbids continue-on-error. The existing focused
Reveal route gains opt-in readiness_native_early with false default; true runs
the same command before controls and the retained original predecessor block.
The late variant is mutually exclusive. Native/service/observer/deadline and
cleanup gates are unchanged. Review, local renewal, focused exact-SHA original
plus all retained workloads/artifacts, then full acceptance remain required.

### Local scheduling renewal findings

The first local full renewal retained2846 tests:2820 passed,three failed,23
skipped. Two failures were historical workflow inventories counting both
mutually exclusive native positions as executions. They now evaluate each OS's
active commands and require the complete original multiset, four unique
creation/native evidence directories and unchanged guards on every other
command. No acceptance command is removed.

The third failure was the existing native deferred-quit control's ten-second
normal-close timeout under the full workload. Its original log is retained;
missing phase operands cannot identify a historical cause. Ranked hypotheses
are quit-request delivery, deferred cleanup progress and exit notification.
The owned fixture now emits four fixed, deduplicated phase labels; on failure,
the control retains only those labels, parent-exit status and the existing finite
forced-cleanup result. It preserves the original error, ten-second limit,
cleanup-complete assertion and profile-removal gate. No product/shared shutdown
helper changed. The isolated actual-Electron control plus both final workflow
inventories passed52 tests with no skips. This is diagnostic evidence, not proof
of the historical timeout cause. Review and final local renewal remain required.

### Local Ladle port conflict

The next complete local renewal retained2846 tests:2822 passed,one failed,23
skipped. Native quit and both workflow inventories passed. The sole failure was
Ladle startup EADDRINUSE on127.0.0.1:60610. A subsequent read-only ownership probe
found an unrelated Codex listener there; it was not stopped or changed. Installed
Ladle selects a port before creating its HTTP listener. Its port-zero get-port
path probes only the default bind host; a nonzero candidate uses all local-host
checks. Whether the original occupant predated the probe or won the release/bind
race is not established.

The existing real Ladle test now holds its own loopback listener and supplies
that occupied nonzero candidate. Ladle must choose a different port while the
owned listener stays open, then still serve every original bootstrap resource
and transform the workspace stories. Its25-second startup,40-second test and
owned child exit gates are unchanged; no retry or unrelated-process cleanup is
added. The dependency's release/bind race is not claimed eliminated. This is a
controlled occupied-candidate path, followed by final full renewal.

### Final reviewed scheduling and harness candidate

Both review axes confirmed no findings for scheduling, active inventories,
fixture diagnostics and the owned Ladle port path. The final complete local
renewal passed2846 tests:2823 passed,zero failures,23 conditional/platform skips,
120.9seconds. The52 focused native/inventory controls,30 route checks, actual
Ladle occupied-candidate check, lint, documentation and whitespace checks passed;
prior typecheck and verified build are unchanged. Earlier failed full logs remain
retained. Exact-SHA focused early native plus retained workloads/artifact and
subsequent full platform acceptance remain in GitHub #26 before integration.

## Early native failure retained; isolated COM read comparison

Focused 38784362321 / attempt 1 on `25f014b8` completed with the same Windows
latest original direct native failure: zero selections, owner deadline. All retained
controls/workloads and Windows2022 controls passed. Artifact11997891490 was
inspected: one exact parent navigation; first binding returned1807ms, first window
item2502ms, document7217ms, parent11763ms; bridge/Explorer/fixture cleanup passed.
Moving native before the UI prefix did not remove the failure, falsifying that
prefix's necessity. First-received markers alone do not prove individual COM call
latency or its OS-level cause.

Opt-in `readiness_com_profile` in the existing focused Reveal route compares the
original bridge with disposable script copies using direct .NET reflection for
COM reads. Four fresh owned parents use original/reflection/reflection/original
order. All deadlines, exact-view guards, permit protocol and the original selection
call remain. Only finite timings, protocol outcomes and cleanup operands are
retained. Unknown bridge termination or unsuccessful exact-parent cleanup preserves
the fixture. This is a diagnostic comparison, not product acceptance or a repair.
Microsoft's [Type.InvokeMember contract](https://learn.microsoft.com/en-us/dotnet/api/system.type.invokemember)
defines the alternate COM invocation; comparative Windows results remain pending.

Both review axes approved the diagnostic after the spec finding was repaired in
`ee55661`: the comparison now changes only reads, retaining the original selection.
The32 focused profile/routing tests, typecheck, lint, documentation and whitespace
checks passed. The local full run on the initial diagnostic source failed2848tests:
2823passed,2failed,23skipped,125.2seconds. Both failures were existing property
fixture normal shutdowns: before-quit/will-quit/quit received but parent-exit not
confirmed within10seconds. This failure is retained in
`work/issue-26-ci/local-full-com-profile.log`; no final/full success is claimed.
Focused32tests were renewed after the read-only repair. Original Windows focused
failure, comparison artifacts, local shutdown failure and subsequent full acceptance
remain open gates in GitHub#26. Diagnostic publication does not satisfy them.

### Supported runtime and rejected comparison inputs

The complete unchanged candidate `45b739b6` passed on the project's supported
Node22.21.1:2848tests/2825pass/zero failures/23skips,141.2seconds. Its earlier
Node26 run remains failed; this comparison does not prove the historical shutdown
cause. The isolated unchanged property fixture also passed3tests.

Focused38786715908 / attempt1 retained the original Windowslatest native failure,
owner_deadline with zero selections. Both required control files passed. Artifacts
11998268069(latest) and11998741776(2022) were downloaded and inspected. Every
comparison child rejected input before OPEN; those timings cannot compare COM
reads, despite the comparison step exiting successfully. This was a diagnostic
harness defect, not evidence for a product hypothesis.

Unlike the original creation smoke, the probe had not canonicalized its temporary
root/target with realpath. `ef91ed1` now does so and rejects a comparison unless it
emits exactly one OPEN and reaches the actual enumeration boundary. Its regression
rejects the exact retained input-rejection shape as well as navigation without a
read. All33focused profile/routing tests, lint and whitespace passed. Shipped
native sources remain unchanged. Renewed actual Windows comparison and original
acceptance are required; final full acceptance will follow an actual verified
repair, not this diagnostic-only publication.

### Valid warm comparison; cold-access experiment

Focused38787470572/attempt1 on440390df again failed only the original early
Windowslatest native command (owner expiry/zero selections). Original controls
passed on both OSes. Artifacts11997969777(latest) and11998189336(2022) were
inspected: all four comparison cases reached COM, dispatched one selection,
independently observed the exact target and confirmed bridge/window/fixture
cleanup. Latest original cases took1706/1592ms and reflection1565/1588ms.
The comparison occurred after the failed original command and therefore tested
warmed state. It neither reproduces the cold failure nor proves a dispatch cause.

The opt-in profile now runs before the original command on a fresh runner and
uses reflection/original/original/reflection order. Default/full scheduling and
all original commands remain. Original success after this profile is warmed
evidence, not cold product acceptance; it cannot open full CI. This changes
experiment order only. All33focused checks, lint and whitespace passed; actual
cold reflection evidence is pending. Shipped native behavior remains unchanged.

## Cold COM read repair candidate

Diagnostic38788236265/attempt1 on5592e3f1 passed. Artifacts11999815279(latest)
and11999105594(2022) were downloaded and inspected. Reflection was the first
Explorer caller on fresh runners:6104ms latest,4565ms2022, one navigation,
permit and completed selection, independently confirmed exact COM/UIA target,
bridge/window/fixture cleanup. Remaining warmed cases also passed; the original
runtime after them passed normal shutdown/restart but is not cold acceptance.
Repeated original cold failures versus this successful cold reflection support
avoiding PowerShell COM read member discovery; they do not prove the exact OS,
RPC, type-library or scheduler mechanism.

Sourcea79e5e4 carries the tested direct .NET IDispatch reads into the shared binding
and captured-item checks. It retains the exact parent/target, HWND/Explorer owner,
Document identity, readiness/rechecks, one GO permit and original SelectItem call.
The10-second child budget and12-second owner deadline stay unchanged. A small
parent-path reader preserves the same Folder/Self/Path reads. Genuine Windows
COM helper controls cover scalar/empty/collection/error results; existing full
binding/permit/deadline controls use test-only dispatch for their PSCustomObjects.
The repeated original cold command is the regression at the actual bug seam.

Temporary comparator source, tests, input and CI step are removed. Historical
comparison source/evidence remains at its immutable runSHA; no Explorer warm-up
precedes the renewed original focused gate. Both review axes found no findings.
Local focused checks:175tests,169pass,zero failures,6actual-Windows skips.
Typecheck, lint, documentation and whitespace passed. Fresh supportedNode22 build
and full suite are running; their actual result, fresh cold original focused
result/artifact, subsequent full acceptance and integration remain pending.

### Reviewed repair local acceptance

Fresh `npm test` on supportedNode22.21.1 rebuilt the complete application and
passed2847tests:2823passed,zero failures,24conditional/platform skips,115.4seconds.
The extra Windows skip is the new genuine COM read control; it must run without
skips in the focused Windows jobs. Both reviewers found no remaining findings;
169focused checks and typecheck/lint/docs/whitespace passed. Only the report changed
after that verified source. Publish this candidate with CI suppression, then run
the actual original early native command on a fresh Windowslatest VM with no
comparison/prefix. Inspect original and all Windows controls/artifacts before
full acceptance on the same SHA. No integration is claimed yet.

## Production cold gate still failed; Item return probe

Focused38789427546/attempt1 on a66cb544 failed the original cold Windowslatest
command with the same zero-selection/owner_deadline result. Both Windows control
steps, including actual COM scalar/collection/error coverage, passed. Artifact
12000135552 was downloaded/inspected: window_item3565ms, document8590ms,
parent8601ms, owner10529ms; no UIA-root boundary before expiry. Document reads
improved, but the Item-to-document interval still consumed about5seconds and
parent/owner reads consumed another1.9seconds. All owned cleanup passed. This
falsifies sufficiency of the direct-read repair; no full CI is authorized yet.

Ranked hypotheses distinguish blocking Item invocation, PowerShell result
marshalling/pipeline processing, and receipt delivery. One optional `item_returned`
marker follows the InvokeMember expression's local assignment and precedes helper
return. Presence confirms that expression returned at least once; absence means
no completion marker was received, not proof of a blocked COM call. No query,
selection, permission, deadline or cleanup gate is changed. Default tracing stays
off,19fixed deduplicated tokens fit the original1024bytes. Genuine Windows controls
cover completion, exception and throwing callback behavior; the adapter retains
zero permits and the owner deadline for both completion-marker kinds. Local170
focused tests passed/6Windows skips, plus typecheck/lint/docs/whitespace. Exact-SHA
original Windows evidence remains necessary; this probe is not a repair claim.

## Item return confirmed late; fixed dispatch identifier trial

Focused38790722907/attempt1 on5b851a79 failed the same cold original command;
artifact11999902980 inspected. window_item3669ms, item_returned9270.4ms,
document9271.3ms, parent9276.6ms, owner11361ms, then owner expiry. Thus the
InvokeMember expression/local assignment had returned by9270ms, and the next
caller boundary arrived under1ms later. A later helper-result pipeline delay is
not necessary for this failure; name lookup, COM invocation/return marshalling
and earlier argument work remain unresolved. Both Windows control steps and all
owned cleanup passed. No full CI was dispatched.

`0c532b3` changes only the collection Item call to its fixed dispatch identifier0.
[Microsoft's SDK IDL](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/ExDisp.Idl#L604-L611)
assigns that member0; [.NET InvokeMember](https://learn.microsoft.com/en-us/dotnet/api/system.type.invokemember)
supports the fixed identifier syntax. This avoids name resolution while retaining
the identical member, index, query/selection count, binding guards and deadlines.
The genuine Windows control compares null/object IUnknown identity for named and
identifier reads without opening or mutating any window; controlled fixtures map
the same member explicitly. Both reviewers found no findings;170focused tests
passed with6Windows skips, lint/docs/whitespace passed. Fresh Node22 build/full
suite is running. Actual cold original result remains required; this trial does
not establish name resolution as the historical cause.

### Trial local renewal retained as failed

Fresh Node22 `npm test` on the reviewed fixed-identifier source rebuilt successfully
but failed2848tests:2823passed,1failed,24skipped,114.9seconds. The sole failure was
the existing property fixture delayed-focus test's normal shutdown, after all
before-quit/will-quit/quit events but no parent-exit within10seconds. Its focus
behavior was not the failed assertion. This repeats the separately retained
native-close failure on the supported runtime, so Node26 alone is not its cause.
The log remains `work/issue-26-ci/local-full-item-dispid.log`. No full success,
platform acceptance or integration is claimed. The fixed-identifier Windows
trial and the local shutdown failure are separate unresolved gates; scoped
Windows diagnosis may proceed without representing this local run as passing.

## Fixed identifier insufficient; minimize the Electron host

Focused38792159524 on a2589726 failed the unchanged cold Windowslatest original.
Artifact12000741165: window_item3771.5ms, item_returned8874.2ms, document8874.9ms,
parent8883.9ms, owner10779.6ms; zero selection and owner expiry. The fixed dispatch
identifier does not remove the delay. All229 latest controls and owned cleanup
passed. Windows2022 failed during npm installation before tests: node-gyp12.4.0
reported `Completion callback never invoked!` on Node22.21.1/Python3.14.8 after
successful header download. Its cause is unresolved; retain verbose install output
on the next changed diagnostic, without retry or runtime substitution.

4786abf repairs a separate property fixture cleanup defect: use the shared normal
close helper once, rather than starting a second close after a timeout. Forced
owned termination never converts normal-quit failure into success. The lifecycle
regression requires one close and confirmed owned-child termination;37focused
checks and12real property cases across4parallel processes passed. This does not
prove the cause of the intermittent normal shutdown timeout or repair that gate.

2e3d8b2 plus review repairs introduces an opt-in bare Electron minimization in
`scripts/diagnostics`. The actual adapter, target, selection count,12second owner,
independent COM/UIA evidence and strict owned cleanup remain required. Removing
Workspace service/SQLite/observer distinguishes host-level behavior from app
context. This diagnostic is not acceptance: it warms the later original. Renew
the diagnostic-disabled cold original on a fresh VM before considering full CI.

Evidence correction: the removed COM comparison runner used the observer's COM-only
default. Its successful exact-target observations confirm COM selection, not
independent UIA agreement. Earlier COM/UIA wording for those comparison results
overstated that evidence. The ordinary original smoke explicitly enables UIA;
its evidence is separate. The new minimal runner enables it and requires verified
selected-target agreement. Review caught and repaired the default-mode omission
before any Windows execution of the minimal runner.

### Bare Electron passed; restore production startup only

Focused38794492680 on3b262f63 passed both Windows jobs; artifacts12002485214 and
12002295374 inspected. The bare host selected once with COM/UIA agreement and
confirmed parent/bridge/Explorer/fixture cleanup. Latest reached first Item1575ms,
returned2888ms, UIAroot5128ms and readiness5977ms;2022 readiness4930ms. Latest's
later warmed original also passed exact COM/UIA, restart and all cleanup;229controls
passed on each OS. This is not cold-original acceptance. npm installation passed,
which alone does not identify the previous install failure's cause.

Fresh Node22 `npm test` on3b262f63 passed2849tests:2825passed,0failed,24skipped in
117.3seconds after build. Log `work/issue-26-ci/local-full-minimal-3b262f6.log`.

Next minimization restores production main/renderer/backend startup with an empty
database while retaining the identical direct adapter call, target and timing.
Ranked predictions: (1) if startup context is sufficient, the Workspace host fails;
(2) if an active source observer is necessary, empty startup passes and a subsequent
source-registered variant fails; (3) if recovery/creation history is necessary, both
pass until that history is restored. Single Windows passes constrain these
hypotheses without proving necessity or eliminating environment variance.

Local minimization checks:64routing/lifecycle tests, lint/docs/diff passed. A real
macOS launch of the actual repository entry confirmed unchanged appPath, ready
backend, trusted diagnostic callable installation, normal close and owned backend
exit. This checks the harness startup/cleanup seam, not Windows native behavior.

### Workspace minimization launch guard correction

On280e0015, Windows2022's new diagnostic failed before returning a process handle:
artifact12000869426 has native:null and preserves the fixture because launch and
backend ownership are unknown. All229Windows controls passed. This is not a native
Reveal reproduction. The restored actual app inherited the bare harness's10second
launch guard instead of the original product smoke's30seconds. Align only that
startup guard with the unchanged original. Native owner12seconds/child10seconds
and normal quit10seconds remain unchanged. Add finite failure-stage/Playwright-timeout/assertion
classification so another harness failure can be distinguished without raw errors.

The same launch-before-handle failure also occurred on Windowslatest:
artifact12001937913 preserved the unknown fixture. Its later original again failed
zero-selection/owner_deadline with successful owned cleanup. No diagnostic Explorer
warm-up occurred. Normalize the repository argument and explicitly retain the
original cwd alongside the original startup guard; both match existing launch.
Both review axes accepted the finite Playwright-specific timeout label.

### Actual empty Workspace passed; restore one observed source

Focused38796156893 on4b284f3b passed both Windows jobs. Artifacts12002133071 and
12001813874 inspected: actual empty Workspace startup, one native selection,
independent COM/UIA agreement, normal quit, backend/bridge exit, exact Explorer
cleanup and fixture removal all passed. Latest readiness5232ms,2022readiness3960ms.
All229controls per OS and latest's later warmed original passed. No original cold
acceptance is claimed. Both normalized launch/cwd and the original30second startup
guard now match original; previous10second before-handle failures do not identify
the native cause.

The next variant restores one source through public create/preview/apply/activate
commands and confirms active source observation. Target and direct adapter call
remain identical; no mutation notification, recovery or project creation is added.
A native failure here would support source-context sufficiency; a pass directs
the next probe toward later context, without excluding environment variance. Default bare mode and cold-original gate remain separate.

Source-variant local checks:64routing/lifecycle tests, lint/docs/diff passed. The
exact public setup sequence ran in actual macOS Electron and confirmed active
observation, normal quit and backend exit. Windows native behavior remains pending.

### Match production executable-resolution timing

Fidelity audit found the direct adapter's default resolver was running inside
each minimal invocation, before its12second owner timer. Production caches the
trusted executable in main startup. Therefore prior minimal passes differ in
pre-intent diagnostic-report/module-resolution work and cannot establish which
Workspace context is necessary. Cache the same trusted system resolver once when
the diagnostic callable is installed, before source setup/intent, and pass that
program explicitly as production does. No PATH/env executable override is added;
a missing program retains the production unavailable behavior. Native deadlines,
readiness, permissions and cleanup remain identical. Run the cold source variant
again only as a changed fidelity probe, retaining the prior result as diagnostic.

### Reduced source scenario reproduced the actual failure

Focused38796787756 on d2f2b4b: artifact12002801300 latest reproduced zero selection,
no permit, owner expiry with one active source, without recovery or creation.
window_item3317ms → item_returned8844ms → parent8853ms → owner10919ms. All owned
main/backend/bridge/Explorer/fixture cleanup passed. Its later warmed original and
229controls passed. Artifact12001364825 Windows2022 source variant passed COM/UIA,
cleanup and229controls. Resolver timing correction5f8e61f remains required for
production fidelity; source context is sufficient in this retained failing run,
not established as the unique cause.

Next changed probe compares fresh cached-resolver bare/watch-only/source contexts
in parallel. Predictions: (1) watch alone sufficient → bare passes, watch fails;
(2) further source context necessary → bare/watch pass, source fails; (3) baseline
or host variance dominates → bare also fails, requiring reassessment. Watch-only
is in main rather than production utility; a pass does not eliminate utility or
observer scheduling. No artificial wait or observer suppression changes original.

Comparison-route local verification:65routing/lifecycle tests, lint/docs and
whitespace passed. The opt-in matrix has fresh host-qualified artifacts and
retains all original controls; actual cached-resolver comparison remains pending.

### Watch-only case red; distinguish CPU, wait and receipt delay

Fresh comparison38797785140 oncf794318: all six host artifacts downloaded and
inspected. Five native contexts passed exact COM/UIA and fixture cleanup. Latest
bare readiness4661ms/source5390ms;2022bare8402ms/source8331ms/watch11168ms. Latest
watch-only failed the exact native pattern: Item3421→returned9142ms, parent9156ms,
then owner expiry, no permit/selection. Its root watcher was active/error-free
before and after. Main and bridge stopped normally, but exact Explorer cleanup
returned pending and the fixture was preserved. All229controls per context and
later warmed originals passed. Artifact12003022323 retains the watch failure;
other artifacts12003550546/12003565661/12003815448/12003785574/12002209219.

Thus Workspace/backend/SQLite/recovery/creation are not necessary in the retained
watch-only failure. One bare pass versus one watch failure supports watch-context
sufficiency but does not establish a unique handle/path mechanism or eliminate
host variance. Cached-resolution source passing constrains earlier overstrong
source-necessity claims; resolver timing alone is not a proven repair.

Next cold-original probe (no minimal/comparison/prefix) adds optional first-traced
method entry plus coarse local process CPU/wall classification. Predictions:
(1) slow measured call with CPU at least half its wall interval supports local
PowerShell/CLR process work; (2) slow call with lower CPU supports waiting or
descheduling, not uniquely remote COM; (3) a fast measured call despite a long
receiver interval points outside that expression, with entry marker distinguishing
pre-helper binding from receipt timing. Buckets use1000ms slow threshold/50%CPU;
they are diagnostic, not acceptance or a profiler. Metric/callback faults cannot
change the COM result. Only the first traced helper call is measured; tracing-off
behavior has no timing reads.23finite deduplicated labels retain1024byte, native
12second/10second child deadlines and zero diagnostic authority. Tagged temporary
instrumentation `[DEBUG-issue26]` must be removed or retained only as explicit
diagnostics before delivery.

CPU-probe local verification:109focused checks (102passed,7Windows-only skips),
typecheck/lint/docs/whitespace passed. Review repaired the current CI marker
inventory to23; historical retained counts remain historical. Actual Windows
metrics/control execution and cold original outcome remain pending.

### CPU-probed cold original passed; audit observer perturbation

Focused38799037162 on d569a381 passed the cold original and all233Windows controls
per OS; artifacts12003317241/12004056117 inspected. Latest Item1160ms → invoking1163ms
→ item_wait_bound2182ms, readiness4480ms. Original COM/UIA agreed; restart, normal
quit and owned cleanup passed. This measures a successful call (~1second with low
local CPU), not the retained5–6second failure. It cannot prove the failed call's
CPU behavior or root cause, and diagnostic-only instrumentation is not a repair.

Independently gate metric reads with `WORKSPACE_REVEAL_ITEM_TIMING=1` (default off),
keeping ordinary trace behavior and all deadlines. Compare fresh enabled/disabled
originals on identical source SHA using the two already owned CI refs. Predictions:
consistent off-red/on-green supports probe perturbation; both red exposes failed
call timing; both green supports environment variance rather than a proven fix.
Genuine COM controls retain tracing with metrics disabled, require no metric reads,
and preserve scalar/error behavior. No full acceptance is opened by the prior
diagnostic-only green.

### Same-SHA timing A/B passed; remove experiments for final candidate

On a43a88fb, fresh cold-original timing-off38800010878 and timing-on38800016157
both passed. Four artifacts12004251341/12004680191/12003548098/12004235984 inspected:
233Windows controls per OS/arm passed; latest originals had COM/UIA agreement,
restart, normal quit and confirmed cleanup. Timing-off retained no timing labels,
readiness5963ms; timing-on readiness5344ms, ~1.3second low-local-CPU Item. Neither
probe-perturbation dependency nor a failed call's CPU behavior is established.
Failed and passed latest jobs advertised the same image windows-2025-vs2026,
20261007.264.1; an advertised image-version change is not the explanation.

Remove both minimal host files and all temporary comparison/timing workflow
inputs, matrices, tests and tagged instrumentation. Keep the direct COM-read
implementation, fixed SDK Item dispatch identity controls,19finite read boundaries,
and the single-owner property-fixture cleanup repair. Preserve strict native/quit
deadlines, actual command, observer and ownership assertions. Install failure logs
remain useful evidence with no retry. Historical experiment results above remain
retained, including their failures and corrected limits; unique historical Item
latency cause remains unproven.

The completed candidate needs fresh local checks, two-axis review, a diagnostic-free
cold original and exact-SHA full platform acceptance before integration. Prior
A/B success does not substitute for checks after this cleanup.

### Clean candidate review and fresh local verification

Both review axes found no remaining findings in25f014b...18d27f6. Fresh supported
Node22 `npm test` rebuilt and passed2848tests:2824passed,0failed,24platform skips,
114.3seconds.139focused checks (132passed/7Windows skips), typecheck/lint/docs and
whitespace also passed. Source is free of the temporary timing/host probes.

Final focused route normalization is CI-only: ordinary cold originals now default
to tracing off, matching full CI/product. An independent explicit
`readiness_native_trace` opt-in retains bounded diagnosis without changing checks,
query/selection counts, observers, deadlines or cleanup. Focused routing controls
cover default/false/true for both early and historical original paths. This avoids
using diagnostic tracing as a hidden final-acceptance precondition. Fresh cold
Windows and same-SHA full platform gates remain pending.

### Diagnostic-free cold original red; isolate returned COM adaptation

Focused38801930332 on39b8b6ed failed the actual first/cold original with tracing
explicitly off. Artifacts12005355650/12005545319 downloaded and inspected:229native
controls per OS passed, but latest original retained navigation1, selection0,
returned0 and `owner_deadline` in opened phase. The bridge stopped (started1,
stopped1, active0, unknownfalse), fixture cleanup passed; no trace timings exist
for this run. This reopens repair work; no full CI or integration is authorized by
that result.

Ranked, falsifiable next hypotheses:
1. Passing returned COM RCWs into PowerShell triggers costly adapter work. Keep
   returned RCWs behind a managed opaque reference and repeat the unchanged cold
   original. A retained slow Item/failure would refute sufficiency of this repair.
2. CLR COM marshaling or the remote Explorer call itself consumes that time. An
   opaque-return failure after the managed call starts remains compatible; a pass
   alone does not identify this alternative or establish a unique historical cause.
3. Host initialization/scheduling varies independently of this boundary. Prior
   same-image red/green results support keeping this alternative; exact-SHA full
   acceptance and explicit evidence are required after any focused green.

The candidate compiles one fixed managed helper on use (load/policy probes remain
non-executing). It wraps returned COM references before returning to PowerShell,
unwraps receivers/arguments inside .NET, and compares underlying IUnknown identity
with both temporary references released in finally. It forwards the captured
Document's sole SelectItem with the captured FolderItem and flags5, without retry.
The owned process retains RCWs until exit; it does not release live captured RCWs
or add another authority, target, selection, deadline or readiness bypass.
Existing user32 declarations share the same compile step before Open. The ready
selection diagnostic's remaining reads also use the shared helpers so opaque
references cannot silently break that consumer.

Windows controls cover opaque real FSO method/property results, separate wrappers
over the same genuine dictionary IUnknown, raw-to-wrapped identity, and managed
SelectItem forwarding of the exact underlying item/flags, one call and exception
propagation. Scalar/null/array/error and controlled ownership/readiness/permit
checks remain. These are regression seams, not substitutes for actual cold
COM/UIA agreement. New Windows execution and full acceptance remain pending.

Candidate verification: both review axes found no remaining findings after fixing
opaque-reference compatibility in the ready-selection diagnostic. Fresh supported
Node22 `npm test` rebuilt and passed2849tests:2825passed,0failed,24platform skips,
114.7seconds. Typecheck, lint, documentation links and whitespace passed. Local
success skips actual Windows COM controls; cold Windows evidence is the next gate.

### Opaque candidate red: distinguish control defect from native timeout

Focused38804048062 on5dfb6611 failed. Both downloaded artifacts retain229controls:
228passed/1failed per OS. The genuine control failed before reaching its COM
assertions: reflection construction through object[] retained a PSObject receiver,
so the managed forwarding method tried PSObject.SelectItem and raised
MissingMethodException. The actual cold latest original still retained one parent
open, zero selections, opened/owner_deadline; bridge/fixture cleanup passed. Thus
that run proves neither opaque-helper correctness nor a native repair.

Repair the concrete control/boundary defect by unwrapping PSObject.BaseObject as
well as opaque holders before dispatch/argument/identity operations. The same
managed-forwarding regression must move from missing-method failure to exactly one
call, preserving the underlying item and flags5. Raw and wrapped property reads
also check this boundary. Microsoft documents PSObject.BaseObject and the default
Windows Add-Type reference to System.Management.Automation:
[PSObject](https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.psobject),
[Add-Type](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/add-type?view=powershell-5.1).
The prior ranked native hypotheses remain open; new cold evidence is required.

The managed PSObject defect reproduced locally with portable PowerShell7.6.7 on
macOS (its Utility manifest imported explicitly): extracted managed-forwarding
control against5dfb6611 fails PSObject.SelectItem MissingMethod; repaired helper
passes MANAGED_FORWARDING_CONTROL, flags/underlying object/exception and property
checks. This executes the language/managed boundary, not Windows COM or PowerShell5.
Both review axes found no remaining delta findings. Two static tests passed,
fiveWindows controls remain platform-skipped locally. The unchanged local full
5dfb candidate receipt is retained; Windows controls/cold originals on the repaired
SHA are the affected gate. Trace-off plus explicit trace-on same-SHA cold runs
will distinguish actual default behavior from diagnostic evidence/perturbation.

### Repaired managed boundary: both cold originals pass, fixture still red

On0cd9ffd6 the cold original passed both trace-off38804975183 and trace-on38804981106.
Artifacts12006790521/12006121489/12006676071/12005863077 downloaded and inspected.
Both latest originals retained exact navigation1/selection1/return1, actual COM/UIA
selection agreement, restart persistence, normal quit and confirmed owned cleanup.
Trace-on Item2563→returned4639ms, Document4640→parent4650ms, readiness9097ms; trace-off
retained no trace. This is original-command success on two fresh hosts, not unique
historical latency-cause proof. Both2022 contexts run controls, not the cold UI.

EachOS/arm still had228/229controls pass. The sole failure moved past forwarding,
FSO, property/opacity checks to the identity fixture's constructor: @($dictionary)
enumerates an empty COM dictionary, passing zero arguments. Fix only this fixture:
build object[1] and assign the receiver into its sole slot; reuse it for both
identity wrappers. Add an empty managed-list receiver guard. PortablePS7 reproduces
the old Constructor-not-found and passes the fixed managed control. Production
source is unchanged by this fixture repair; all prior assertions remain.

Fresh0cd9ffd6 supportedNode22 full local receipt:2849tests/2825passed/0failed/
24platform skips,113.7seconds. The fixture delta's two static checks pass, five
Windows checks skip locally. Its actual Windows controls and unchanged cold command
must pass on the completed candidate before full same-SHA acceptance.

### Opaque-only repair insufficient; type the original collection Item call

Focused38805690325 on09bf7a8b:229/229controls passed on bothWindows OS, including
all genuine managed/COM controls. The unchanged cold latest original still failed
navigation1/selection0/return0, opened/owner_deadline, with confirmed bridge and
fixture cleanup. Artifacts downloaded and inspected. This refutes opaque holder
sufficiency; the two prior cold greens were not a completed repair.

Next ranked native hypotheses: (1) generic reflection/object-result COM marshaling
performs expensive runtime type discovery; a typed IShellWindows::Item call with
the SDK's known IDispatch return should avoid that discovery; (2) intrinsic remote
Item latency remains slow even with typed ABI, refuting that sufficiency; (3) host
initialization/scheduling also contributes, so single passes remain weak cause
evidence. The preceding successful trace measured ~2secondItem versus retained
~5–6second failures, not CPU or unique root cause.

Narrow candidate: replace only the fixedDISPID0 reflection call with the original
IShellWindows::Item vtable call. Four inherited IDispatch slots, Count, then Item
match the official [ExDisp.idl](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/ExDisp.Idl#L598-L611).
VARIANT index is still the same integer0..255 by value; the returned IDispatch is
an opaque typed interface. Let the CLR marshal both, with no manual VARIANT memory,
manual vtable pointers or new executable. HRESULT failure throws with no fallback.
All collection-count, exact parent/target, IUnknown, HWND/Explorer/UIA, readiness,
pre/post, captured-item, permit and single selection guards/deadlines stay intact.
Genuine controls compare the typed Item result to the named original identity,
reject malformed indices against the real ShellWindows collection, and separately
reject unrelated COM collections. Local managed-boundary controls compile/pass on
portablePS7;72focused checks passed/6Windows skips, whitespace passed. Windows cold
and actual controls on this new candidate remain required.

Typed-item candidate review: both axes found no remaining findings after moving
invalid-index controls to the real ShellWindows receiver. Fresh supportedNode22
`npm test` rebuilt and passed2849tests/2825passed/0failed/24platform skips,114.4s.
Lint/typecheck/docs/whitespace and the portablePS7 managed control passed. Same-SHA
trace-off original plus explicit trace-on interval evidence are next; full CI
remains behind the affected original/control/artifact gate.

### Full candidate: Windows cold passes; macOS fixture setup budget fails

Reviewedbc74cd01 passed trace-off38807089714/trace-on38807095565. All229controls
per OS/arm and both cold originals passed; four artifacts12007655490/12006921595/
12006683510/12005919198 inspected. Both originals retained exact single navigation/
selection/return, COM/UIA agreement, acknowledgment, normal quit/restart and owned
cleanup. TracedItem1478→returned2870ms/readiness5894ms. Full38808047668 on the same
SHA also passed its ordinary cold Windows latest command, then continued platform
checks. These are acceptance observations, not unique historical latency proof.

New full failure: macOS platform suite original command `npm run test:platform`,
job116674477000,2340passed/1failed/24skipped. Sole failure is property-driver file
line87: `page.setContent: Timeout100ms exceeded`, before openPropertyCreator.
Full job log and artifacts12008310869/12008116080 retained/inspected; expected
negative category-fixture receipts are controls, not additional failed tests.
Other OS results remain pending; downstream macOS runtime/package stages unreached.

Ranked hypotheses before repair: (1) the negative test installs the subject's100ms
page deadline before fixture HTML preparation, so slow setup fails before testing
its intended driver deadline; (2) initial navigation/readiness is incomplete, but
withPage already awaits the fixture's initial URL load, and the retained exception
specifically identifies the later setContent; (3) shutdown fails independently,
but this receipt has no cleanup failure and every other property case passed.
A minimized local setup slowed by a deliberate250ms inline fixture script should
reproduce setContent failure with the old ordering. Scope the same100ms deadline
after fixture preparation, repeat that control and the unchanged original file;
keep driver refusal/zeroactivation/noeditor and the10second normal quit unchanged.
The artificial load belongs only to ignored local reproduction, never product or
acceptance source. No product deadline is raised.

The ignored250ms slow-HTML reproduction failed at the same setContent100ms with
old ordering and passed after moving only deadline arming. The original property
file plus routing tests passed34/34 locally. Both review axes found no remaining
findings. Fresh supportedNode22 `npm test` rebuilt and passed2849tests/2825passed/
0failed/24platform skips,109.5s; lint/docs/whitespace passed. No application code
changed in this repair. New `checks: property-fixture` selects only the existing
macOS original-file job; historical ETW union and default full/push coverage remain.
Actual macOS original and exact-SHA full acceptance remain pending. The old full
run's Windows platform suites both passed and runtime stages are still in progress.

### Complete full failure map; property original passes on repaired source

Focused38810096474 on36aca7a4 passed the exact macOS property-driver file3/3 with
normal quit; artifact12008136997 downloaded/inspected. Full38808047668 onbc74
completed with three failed jobs. BothWindows platform suites and all cold/direct/
grouped creation-native predecessors passed. macOS retains the setup100ms failure
above; MultiSelect dev/package stages remain unreached on allOS.

Windows2022 job116674476987: original `npm run smoke:runtime -- dev` failed raw
external category rename at smoke-runtime.mjs906 with EPERM. The category fixture
is owned/Unicode/long-path; mode-change/recovery passed, automatic reconciliation
and subsequent lifecycle stages unreached. Artifact12007229183 and complete job
log downloaded/inspected; fixture cleanup passed. No Explorer invocation occurs in
that ordinary runtime's pre-rename code. Production Windows observer already
watches only source roots; category scans remain active, using legacy descendant
realpath and complete identity checks. No new retry/settling/observer bypass is a
repair until the actual boundary is diagnosed.

Ranked EPERM hypotheses: (1) transient production scan/descendant-handle overlap,
compared by existing idle/observation/concurrent-scan/native/legacy stress cases;
(2) a persistent owned handle or external Windows sharing conflict, constrained
by category/child held-handle and DELETE-sharing controls; (3) unrelated host/
antivirus or long-path behavior, constrained by identical owned idle fixtures,
without claiming exact historical OS attribution. A narrow runtime-observation
selector reuses the realWindows2022 original and existing comparisons; diagnostic
failure cannot skip the original after successful build. It changes no product,
original command, deadline or assertion.32routingcontrols pass locally.

Windowslatest job116674476751: original `npm run smoke:runtime -- dev` passed its
main runtime and rename portions, then failed RU category-unavailable guard at
smoke-project-category-move-ui.mjs610: post-action staleText with one authored ID,
while the oracle assumes stale means pre-submission zeroIDs. Artifact12007768429
and complete job log downloaded/inspected. RU unavailable proof has unchanged
durable journal; visible stale editor/metadata/text retained. Component code can
accept a rejected response and then display stale when observation advanced while
that already-authored request was in flight. This is a falsifiable oracle-race
hypothesis, not permission to accept an unproved command. A rigorous repair must
retain zeroIDs for truly blocked submission, prove any single in-flight rejection
through its actual bound typed reply, and independently verify no effects. Full
CI stays gated on bothWindows original failures plus the repaired macOS file.


### Category stale-authoring regression and exact unavailable reply proof

The Windowslatest post-action stale message alone cannot establish command order.
An actual same-turn EN/RU component reproduction emits the new observation and
presses Enter before React commits its disabled state. Old code authors one UUID
and command; the live-ref pre-authoring predicate now blocks both (zero UUIDs and
commands). Revision and source-unavailable same-turn cases are covered too; an
already-authored rejected request remains distinct. Recovery/status is unchanged.

The runtime oracle now observes the real main MessagePortMain request and reply,
correlated by exact immutable command fields, UUID, port and transport ID. It
accepts zero IDs only with zero requests/replies and disabled stale controls. One
ID requires exactly one bound request and actual typed rejected reply with an
explicit null operation and a finite justified problem. ENOENT during destination
parent inspection can legitimately produce source_unavailable before observation;
category_unavailable/stale_configuration/filesystem_changed are also retained.
Duplicate counts remain active through action/state/UI inspection, then atomic
disposal returns the final snapshot. A later forwarding wrapper cannot reactivate
the disposed observer. No command, preload or forwarding replacement is supplied.
Both branches independently compare the journal, captured metadata, projects,
sibling, Text, other source, settings/configuration/events and no-follow trees;
only the deliberate removed empty category is allowed. Failure evidence retains
IDs and receipt too. Two review axes identified and repaired the missing ENOENT
classification and forwarding-wrapper lifecycle case.

Fresh supportedNode22 npm test rebuilt and passed2868tests/2844passed/0failed/
24platform skips,112.5s. This predates the small review/CI evidence-only delta;
its affected checks and actual local category UI are being renewed.

### Windows2022 original advances; next native rename boundary is unresolved

Runtime-observation38811438671 on54c7bf2e completed. Its exact original dev command
passed the previously failing external category rename and full baseline runtime,
then failed direct rename Reveal: Native rename Reveal did not return. Owned
native/Explorer/backend/fixture cleanup was confirmed. Artifact downloaded and
inspected. All32 comparison operations completed with preserved invariants and
cleanup: idle/observation/concurrent production scan and legacy/production-scan
stress rename succeeded; native descendant realpath stress failed EPERM4/4;
child held-handle controls failed EPERM as expected. This does not attribute the
historical one-off EPERM to current production scans or justify adding a retry.

Ranked next native hypotheses before probing: (1) the existing fixed COM/UIA
readiness chain exceeds its unchanged12s owner/10s child bound on Windows2022;
(2) strict binding/target/readiness fails for this post-rename fixture; (3) the
service rejects before native selection, or the graphical request never arrives.
The old runtime receipt did not retain Windows native/service failures, so it
cannot distinguish these. Extend only the existing passive actual native receipt
to Windows and retain the same finite bridge failure/19 trace phases already used
by creation. Compare default-off originals against explicit trace-on evidence;
no assertion, deadline, selection/navigation count, ownership or product retry is
changed. runtime-observation now selects both affected Windows originals, with
actual minimized category UI and regressions before an independently gated full
original. Historical category-fixture remainsWindows2022-only; full/push stays
unchanged. Focused originals and same-final-SHA full acceptance remain required.


After the review repairs and CI evidence delta, focused checks passed320/320 with
zero skips, lint/typecheck/docs/whitespace passed. Actual local Electron
`npm run smoke:runtime -- dev --category-move` passed the full EN/RU category,
rejection, restart and controlled recovery routes with normal shutdown/owned
cleanup. Both unavailable receipts contained one exact bound request/reply,
rejected/source_unavailable/null operation and unchanged independent state proofs.
Both narrow EN/RU unavailable screenshots were inspected. Windows remains required.


### Reviewed682e Windows map and per-launch exit-proof repair

Focused38813308051 on682e4430: Windows2022 completed the entire unchanged original
dev command, including rename/category EN/RU, native Reveal, restart/recovery and
owned cleanup. Its original and minimized unavailable receipts were exact single
rejected/source_unavailable/null-operation replies; preservation passed. Latest
passed its minimized category command but original direct rename Reveal failed:
opened/owner_deadline, one open/zero selection/return, actual valid bound service
rejection native_unavailable at12036ms, stopped owned bridge and cleanup confirmed.
This refutes a completed native latency repair even after earlier cold greens.

Trace-on38813313552: latest passed both native Reveal invocations (7020ms/2135ms)
and every rename/recovery route/46 normal shutdowns, then rejected final cleanup:
backend_present on the sixth cumulative PID probe;60 parents exited. Windows2022
failed before runtime while preparing Electron headers: node-gyp12.4.0 reported
Completion callback never invoked afterHTTP200. No compiler source error was
reported; exact underlying download/stream cause remains unresolved. Complete
job log retained locally. No artifact existed because build had not created its
evidence directory. Add strict build tee/mkdir and node-gyp verbose logging to
this focused route only; no retry or compiler/production change. All downloaded
runtime artifacts and required receipts were inspected; all focused gates have
not passed and full acceptance remains pending.

Cleanup hypotheses: (1) historical numeric PID reused after its already-confirmed
exit; (2) genuine backend survival, constrained by46 passed shutdown/ESRCH probes;
(3) an earlier backend omitted by final metrics, constrained by retaining the
union for each owned launch. Historical per-PID attribution is unavailable.
Microsoft documents that [process IDs can be reused after termination](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.id).
A deterministic old-predicate reproduction confirms absence/normal shutdown, then
simulates unrelated numeric reuse; cumulative final inspection wrongly reports a
surviving backend. The repair attaches immutable ESRCH proof to the exact owned
launch/PID occurrence, after confirmed parent exit. Every new launch/PID occurrence
starts unconfirmed, even when its number matches a previous exited occurrence.
Retain the union of all PIDs observed within a launch, including earlier ones
omitted by final metrics. Final inspection probes only unconfirmed occurrences;
unknown launches, failed metrics, parent uncertainty, non-ESRCH and normal-quit
failure remain vetoes. Publish only finite occurrence counts, never process data.

The initial actual local rename run exposed a repair bug: querying
ElectronApplication.process after disposal throws in Playwright. Capture its
ChildProcess once at launch, retain it for parent-exit evidence, and add a test
whose disposed application refuses process access. Actual local original is being
repeated. Native phase evidence is also retained on success so traced intervals
can be compared; defaults, selection authority and12s/10s bounds are unchanged.


Both review axes approved the occurrence correction, including its category
consumer. Actual local rename repeated successfully:60 parent launches exited,
46/46 backend occurrences confirmed,0pending. Actual category repeated
successfully:44 parents exited,34/34 backend occurrences confirmed,0pending.
Both fixture cleanups passed. SupportedNode22 full unchanged-build test:all then
passed2870tests/2846passed/0failed/24platform skips,110.8s;54 startup/routing and
59 lifecycle/rename focused checks passed, with affected small deltas renewed.
Typecheck/docs/whitespace passed. Current Windows native latency remains unresolved;
next focused trace-off/on originals run the reviewed ownership/build-evidence
candidate before full acceptance. Artifacts12009827088/12008909993/12009657444 from
682e were downloaded and inspected; trace-on2022 had no runtime artifact because
its prerequisite build failed.


### b9ba focused map: lifetime repair passes; remaining native/diagnostic cases

Ordinary38815558139: latest again failed the original direct rename Reveal at
opened/owner_deadline, one open/zero selection/return; actual ownership correction
passed with1/1backend occurrence confirmed. Windows2022 original passed the whole
runtime, but its separate diagnostic-control test failed stress_legacy: first
single rename EPERM during6414successful child legacy realpath reads, service
closed, reader/renamer exited, all original state invariants passed. Trace-on
38815586818 passed both complete Windows jobs, originals and controls. Its actual
latest rename retained46/46backend proofs,0pending, normal quit and cleanup;
category passed too. All runtime artifacts downloaded/inspected. Native latency
is not fixed merely by these traced greens. Header preparation passed all four
builds this time; historical node-gyp stream failure remains unattributed.

New ranked native hypotheses: (1) the remaining raw ShellWindows return re-enters
PowerShell COM adaptation before opaque Count/typedItem reads; (2) remote Item,
Explorer/UIA initialization or host scheduling varies independently; (3) tracing
perturbs the readiness race. Healthy first trace reaches enumeration1224ms,
collection1232,Item1761→returned2901,owner3522,UIAroot4945→properties5616,
readiness5959. These intervals do not isolate the failed untraced boundary.
The narrow next candidate routes only Windows() through the existing managed
opaque helper, without passing its Item-completion trace callback. Original exact
Count/index/parent/target/Document/HWND/owner/UIA/readiness/GO/prepost guards and
single selection remain intact. Genuine Windows controls now cover opaque
ShellWindows ingress itself, raw/wrapped IUnknown, integerCount and typed/named
Item equivalence through the wrapped collection. Fixed-controller enumeration
counts remain3 for immediate readiness/5 for delayed readiness. Existing static
boundary test is red before/fixed after; local native checks72passed/6Windows
skips. This is a testable repair hypothesis, not historical latency attribution.

The legacy stress assertion was an unsupported deterministic contrast. Its old
actual red is retained. Node22 legacy realpath walks components via lstat; see
[Node fs implementation](https://raw.githubusercontent.com/nodejs/node/v22.21.1/lib/fs.js)
and [libuv Windows fs implementation](https://raw.githubusercontent.com/nodejs/node/v22.21.1/deps/uv/src/win/fs.c).
This makes transient child metadata sharing compatible with the result, but does
not identify the exact historical handle. Ranked alternatives are transient
reader overlap, unrelated external/host interference and permanent fixture/state
failure. An independent quiescent control distinguishes the last alternative;
it does not establish the actor. Two-axis design review requires keeping original
negative response/timestamps/single invocation/realRenameFailures unchanged.

Only Windows stress_legacy exact EPERM can add this diagnostic control. Close
service and extraSQLite handle before the original snapshot. Require confirmed
reader/renamer exits,0watches/timers, then compare the entire no-follow owned
fixture's identities/bytes against before-first-attempt state. Only then record
one separate same-API forward move and one restore, with full identity/bytes/SQLite
checks after each. No observer reopens before control completion. Failures,
unknown children, changed state, missing/extra operations or other errors cannot
pass. Parser exports finite classifications/counts only; an unknown control child
blocks coordinator cleanup. Product/idle/production-scan originals stay strict;
no product retry/deadline/observer change is introduced. The documented diagnostic
oracle change is explicit and preserves historical failed evidence. Actual Windows
acceptance of both this control and the native candidate remains required.


Both axes accepted this native/diagnostic candidate after correcting a test-only
assumption: two separate Shell.Windows calls need not return identical collections.
Same-object IUnknown is now checked by wrapping one exact collection; actual new
ingress separately checks opaque return/integerCount/typedItem. Counterfactual
move/restore also requires exitCode0. Focused diagnostics/routing:82tests/79passed/
0failed/3Windows skips; native78tests/72passed/0failed/6Windows skips. Fresh
supportedNode22 npm test rebuilt and passed2879tests/2855passed/0failed/24platform
skips,109.0s. Lint/typecheck/docs/whitespace passed. Actual Windows controls and
ordinary originals are still required; full acceptance has not been requested.
Earlier checkpoint text said30 comparisons; exact artifacts contain32 operations
per complete comparison run. Original negative counts remain separate and retained.


### Opaque collection does not resolve the quiet native failure

On reviewedee4c3683, all four focused builds, native/diagnostic/occurrence controls
passed. Ordinary38818781252 Windows2022 completed the entire original; latest
again failed direct rename Reveal at opened/owner_deadline, one open/zero
selection/return, valid bound rejected/native_unavailable at12037ms. Its owned
main/backend/bridge exit was confirmed, but exact Explorer cleanup timed out and
left one native target; fixture cleanup correctly stayed skipped/preserved.
Immediate-trace38818811358 passed both complete Windows originals and all controls.
All four exact-SHA artifacts were downloaded and inspected. The three passing
originals retain46 normal rename shutdowns,34 category shutdowns per category run,
and successful process/native/fixture cleanup. Both2022 comparison artifacts
completed32operations, retaining3 ordinary/4 traced original negative outcomes.
The collection
repair is therefore insufficient; traced successes do not establish native repair.

Next ranked hypotheses: (1) a specific managed Read/Call/identity boundary remains
in flight beyond budget, including unwrap/dispatch/wrap; (2) the last managed call
completed and execution stalls elsewhere in PowerShell/owner/UIA/Open; (3) frequent
trace callback/output perturbs scheduling, while quiet observation may differ too.
Existing bare/main/source/CPU experiments above already constrain these cases;
do not repeat them or guess another production rewrite without a failed-boundary
observation. A matched default-off/quiet-checkpoint diagnostic tests this directly.

Temporary DEBUG-issue26 code is explicitly gated by runtime_native_checkpoint /
WORKSPACE_REVEAL_DEFERRED_TRACE=1, defaultfalse. Start one managed timer immediately
after helper initialization/compilation, before Shell creation, with its callback
scheduled for nine seconds later; this is not the
adapter-spawn time origin. Record only fixed last-operation/inflight/sequence in
managed Read/Call/SameIdentity entry/finally, with no per-call clock, CPU, scriptblock
or console output. At the one timer callback, capture coherent state plus actual
helper-clock elapsed before writing one bounded line. No COM/PS objects or locks
held across COM/IO enter observation. Callback/init/env/output faults are caught;
normal/failure stop disposes without waiting. Already captured output can race
stop/DONE but remains evidence only. Sequence is capped100000, elapsed12000ms.
Deferred mode suppresses immediate trace callbacks/output, even when both flags
are set. The parent accepts at most one strictly allowlisted requested line,
retains actual adapter-receipt elapsed separately, never changes protocol state,
GO, native selection, byte budget or12s/10s deadlines. Unrequested, malformed,
duplicate or immediate-trace lines in deferred mode fail closed.

An active snapshot covers helper unwrap, dispatch and result wrapping, not a
uniquely identified substep. Inactive means last completed helper, not current
execution location. Missing checkpoint is unknown (late timer/exit/delivery or
observer failure); it is never handle absence or a pass. Tracking/JIT/timer setup
can perturb earlier execution, and output may perturb it after the snapshot.
This probe is diagnostic, not product acceptance or a repair. Remove temporary
instrumentation before final acceptance unless explicitly retained as diagnostics.

Exact shared code compiles under portablePS7.6.7. Nine controlled pure-managed
cases cover off, deliberately blocked method, real timer delivery during a blocked
method, completed/throwing method, disposed,
console failure, writer-versus-disposal race and dual-flag precedence. No Windows
COM or PS5 acceptance follows from this portable check. Node protocol controls
cover noGO/state/deadline changes, finite fields, requested-only/single marker,
malformed/duplicate/range errors and already-captured output afterDONE. Actual
WindowsPS5 controls and matched original results remain required.

The added real-timer control passed portablePS7 (active other_call, sequence1,
32ms actual elapsed). Both review axes accepted the temporary diagnostic after
the timer-delivery regression and chronology clarification. Fresh supportedNode22
build passed; affected protocol/COM/routing/artifact/build checks passed164tests/
150passed/0failed/14platform skips. Lint, typecheck, documentation links and
whitespace passed. The prior completed production candidate's full2879test local
result is inherited; this diagnostic has focused verification and no full or
platform acceptance claim.

### Quiet failed snapshot reaches the owner/UIA boundary

On18781e20, ordinary38821357781 passed both Windows originals. Deferred38821362378
passed2022 but latest failed the original direct rename Reveal, one open/zero
selection/return, opened/owner_deadline. The retained single checkpoint is
read_hwnd/complete/sequence82, helper9001ms, adapter9487.16ms; the actual bound
reply is rejected/native_unavailable after12101.62ms. This rules out an in-flight
managed Read/Call/identity at that snapshot only. It does not identify later work
or prove that the observer caused or repaired anything. The next source segment
after that initial HWND read is Read-WorkspaceReadyOwner: exact Win32 ownership,
process identity and UIA root/current properties/tab guard. No selection was sent.
Owned main/backend/bridge exit was confirmed, but exact Explorer cleanup retained
one native target and fixture removal correctly stayed skipped. Artifact12012822840
and exact job116718447731 log were inspected. All625PS5 controls passed, including
the nine managed snapshot controls and actual timer delivery. Both passing
ordinary originals and deferred2022 retained46 normal rename shutdowns and cleanup.
All four artifacts were downloaded. Default-off success plus deferred failure
keeps host variance/observer perturbation possible; neither is uniquely proven.

Next discrimination ranks UIA root retrieval, UIA current-property reads and
descendant tab query as possible delays, with Win32/process probes remaining
separate alternatives. Refine only finite in-flight leaf labels around those
existing operations, keeping the single timer, no per-leaf output/clock/callback,
all owner/tab guards and unchanged deadlines. A failed leaf snapshot is required
before choosing a product rewrite; no full acceptance is requested yet.

The refinement adds five non-nested fixed scopes: owner_validation (the existing
Win32/type/process short-circuit predicate), uia_root (the whole existing
Get-WorkspaceUiaRoot call, including assembly load and PS return), uia_properties
(the existing Current/process predicate), uia_tabs (FindAll and Count guard), and
uia_owner (final Current.ProcessId comparison). No reads are cached/hoisted or
reordered; existing early returns and exceptions pass through finally cleanup.
Opt-in direct managed Begin/End calls neither output nor enter observer callbacks;
the shared script checks helper presence without initializing/compiling it.
The one timer, snapshot limits, strict parent allowlist and zero authority remain.
These blocks still include multiple operations and PS overhead; a label cannot
identify an individual COM/UIA subcall or prove scheduling is unaffected.

Actual PowerShell wrapper controls use the production-created timer with only a
test-shortened due time: managed root, Current getter and tab-query blockers;
throw/early-return cleanup; invalid-tag rejection; helper-absent standalone load;
dual-flag precedence. Six portablePS7 cases passed. Two controls requiring actual
Windows UIA types and all WindowsPS5/original evidence remain pending.
The checkpoint opt-in now selects Windows latest only, matching the remaining
failure; ordinary runtime-observation still selects both Windows variants.
Category-fixture and all default/full coverage remain unchanged. No unchanged
ordinary2022 rerun is needed for this diagnostic-only refinement.

Refined-probe local supportedNode22 verification: fresh build, lint, typecheck,
documentation links and whitespace passed. Affected protocol/COM/shared-controller/
routing/artifact/build checks passed178tests/155passed/0failed/23platform skips.
The eight wrapper cases are registered as independent top-level tests (review
caught initial nesting under an unrelated Windows test). Both2022 matched
comparison artifacts retained32operations/4original negatives; all four matched
jobs passed85observer/rename and625category/native/occurrence controls. Passing
category scenarios retain34normal shutdowns and successful cleanup. These are
diagnostic receipts; the refined actual Windows-only controls and original remain
required, followed by cause-supported repair/cleanup and final acceptance.
Both review axes accepted the refined probe after fixing top-level registration;
the spec review also confirmed the opt-in-only latest matrix boundary.

### Bounded fresh-host replication captures Item again

Refined38823349864 passed all85observer/638category-native controls, including
all eight actualPS5 wrappers, and both original native calls at3936.87/1193.56ms.
Neither reached the9s timer. All46owned backend exits and native/fixture cleanup
passed. This success did not locate the intermittent failed leaf or prove repair.

The evidence review accepted exactly two predeclared fresh Windowslatest hosts
on0f8936bc with the validated quiet probe, seeking red evidence rather than retrying
until green; the batch ended after both. ReplicaA38824555668 failed direct native
Reveal at opened/owner_deadline, one open/zero selection/return. Its checkpoint is
call_window_item/active/sequence91, helper9001ms, adapter9435.87ms. All638controls
passed; owned parent/backend/bridge/native cleanup and fixture removal passed.
ReplicaB38824560016 passed the complete original; native5368.85/2143.28ms, no9s
checkpoint,46exit proofs/zero pending and cleanup passed. Both artifacts/logA
were inspected. The active Item helper covers unwrap, dispatch/marshaling and wrap;
it is not a call-duration measurement or identification of an OS blocking actor.
The earlier read_hwnd/complete snapshot still does not establish a unique UIA cause.

Next ranked predictions: a bounded alternative to indexed Item acquisition may
avoid that boundary; cumulative repeated COM checks may consume the budget even
with a different acquisition method; independent host/scheduling variance may
still dominate. Test the first as an explicitly gated counterfactual, not a claimed
repair. Preserve all downstream identity/parent/owner/UIA/readiness/path/GO guards.

`runtime_native_enumerator` / WORKSPACE_REVEAL_ENUMERATOR=1 defaults false and
changes only candidate acquisition. The same Shell.Windows opaque collection
uses SDK-typed get_Count and _NewEnum, then managed IEnumVARIANT.Next(1) with
IntPtr.Zero fetched pointer, exact S_OK entry/S_FALSE exhaustion. Accept at most
256entries plus one terminal check; reject errors/other HRESULTs/null/nonCOM/
duplicate IUnknown/short/extra/changed counts. Count is validated before and after,
and length must match. No prefix acceptance, retry, Item fallback, warm-up or
cached enumeration. Return only opaque holder arrays; RCWs remain owned by the
short-lived bridge. Every binding invocation gets a fresh enumeration, then one
common downstream validation/selection path. Baseline indexed order/count calls
remain unchanged when disabled. Matching counts cannot detect same-count
replacement; this is bounded enumeration, not an atomic membership snapshot.

The ABI follows [SDK ExDisp.idl](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/ExDisp.Idl#L604-L614),
[Microsoft _NewEnum](https://learn.microsoft.com/en-us/windows/win32/api/exdisp/nf-exdisp-ishellwindows-_newenum)
and [managed IEnumVARIANT.Next](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.comtypes.ienumvariant.next).
The explicit pointer count uses the documented one-element return convention;
no manual unmanaged buffer or marshaler is introduced. Finite quiet-checkpoint
allowlists add only call_window_enum, with unchanged byte/deadline/authority limits.

Controls cover both acquisition branches through the existing shipped consumer's
entire readiness/permit/identity/late/rejection matrix. Managed reducer controls
use genuine COM-valued entries for0/1/2/256 positives and malformed/duplicate/
short/extra/count-change/exception/257th-entry negatives. Separate genuine MSXML
IEnumVARIANT0/1/2-node controls exercise positive COM variant marshaling without
opening Explorer UI; these are not multiple Explorer windows. The actual
ShellWindows endpoint checks the available collection's typed count/opaque results
and unordered Item-versus-enumerator identity set. The actual original remains
required for positive Explorer acquisition/selection/cleanup. Seven portablePS7
empty/error/type/limit controls passed; genuine COM/PS5 controls and matched native
counterfactual evidence remain pending. No production repair/full acceptance claim.

Both review axes approved this diagnostic candidate against the SDK ABI and
common guard contract. Fresh supportedNode22 build, lint, typecheck, documentation
links and whitespace passed; affected protocol/COM/shared-controller/routing/
artifact/build checks180tests/156passed/0failed/24Windows skips. PortablePS7 compiled
the exact helper/control and passed all seven portable controls. A direct portable
reflection check confirms the empty result remains an Array of length0 across the
PowerShell boundary. The MSXML fixture explicitly unwraps PSObject in managed code
before its IEnumVARIANT cast; that test-only path does not change production.
Expanded endpoint controls add COM work before the original, so the next off/on
comparison must use this same SHA with identical prerequisites. Earlier replicas
are retained historical evidence, not a matched baseline for this acquisition change.
