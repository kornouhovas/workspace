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
