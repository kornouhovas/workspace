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
