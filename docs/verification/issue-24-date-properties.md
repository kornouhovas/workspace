# Issue 24 verification

Requirements/current acceptance: [GitHub #24](https://github.com/kornouhovas/workspace/issues/24).
Contract/scenarios: [plan](../plans/issue-24-date-properties.md).
Baseline: `947d4eca`; task branch: `codex/issue-24-date-properties`.

## Observed focused evidence

- The first real-SQLite Date creation/save/sibling/reopen scenario failed on the baseline,
  then passed after Date service/storage implementation.
- Built-backend IPC rejected Date on the baseline; its Date command scenario passes after
  production entry wiring and migration resource copying. Renderer EN/RU creation cases
  failed before the Date button/editor and passed after the shared Table/cell extension.
- Date service scenarios passed for valid/invalid boundaries, Gregorian leap rules,
  no-op revisions/events, settings/reopen, clear, ownership/type rejection, persistence
  failure rollback, populated Text/Number-preserving upgrade and retained/archive editing.
- The first migration run had 331 passes, one stale last-migration index expectation failure
  and one platform skip. The expected index is updated; preservation/rejection assertions
  are retained. Relevant schema inventories, count/tag and package fixtures are updated.
- EN/RU keyboard interactions through real SQLite/service passed: exact date save,
  impossible-day retention/error/focus, canonical editing, same-property language switching
  with preserved draft, cancellation, early year display and empty-value clearing.

## Independent review

Standards: one low-priority duplicate Date migration entry in the artifact fixture;
removed, with 46 artifact checks passing. No documented standard violation remained.
Spec: zero missing/incorrect requirements or scope-creep findings. A nonblocking test
observation identified a subscriber detached by service reopen; each subsequent boundary
case now subscribes to its actual service before checking no-op notifications.

## Native macOS evidence

The development and unsigned packaged macOS arm64 applications passed `smoke:date` in
both languages. Actual preload/IPC/backend creation, exact day display, invalid draft/value
preservation, keyboard focus/Escape, empty Save, same-property language switching, siblings,
SQLite reopen and unchanged sentinel bytes passed. Real Chromium timezone overrides were
verified for America/Los_Angeles, Pacific/Kiritimati and Pacific/Apia, with independent
expected labels for years 0001/0099/9999, the skipped Apia day and a DST boundary. EN/RU
1024×720 and 1440×960 captures were inspected; controls/errors remain usable.

Both modes verify ordinary Electron shutdown, backend exit and fixture cleanup. Package
resources passed artifact validation. Evidence is retained under `work/issue-24-date-runtime/`
and `work/issue-24-date-package/`. These are disposable fixtures, not live user folders.
The renewed migration suite passed: 332 passes, zero failures, one platform skip.

Final full-suite/static results are recorded below when observed. Target-platform CI and
integration remain in GitHub; local macOS does not prove Windows.

## Completed local candidate

- Node 22.21.1; dependencies installed independently with `npm ci` in the task worktree.
- Build, lint, typecheck, Markdown links (129 files) and diff checks passed.
- First full run: 2,736 passed, two failed, 21 platform skips. Both failures were inherited
  negative-create fixtures treating the newly supported Date type as invalid. Their input
  now uses unsupported Select; rejection, state and no-notification assertions remain.
  Both reviewers confirmed the repair; focused artifact/Text/backend suites passed 115 tests.
- Final complete candidate full suite: 2,759 tests, 2,738 passed, zero failures,
  21 platform skips. The unchanged verified build was reused. Date focused service/IPC/UI
  passed 10 tests after strengthening the reopen subscription coverage.
- Development/package native Date smoke and artifact resources passed as described above.
  No version bump, release tag, signing or stable release publication occurred.

CI inherits all existing common/static, platform, filesystem/recovery/native and package
routes. Date's real SQLite, IPC and mixed UI suites default to platform coverage; Date
EN/RU boundary/timezone development and package smoke steps and evidence upload were
added to each existing macOS, Windows latest and Windows 2022 acceptance route.
Exact-SHA CI/integration results remain in the GitHub checkpoint.

Review totals: Standards 1 original / 0 outstanding; Spec 0 findings. The nonblocking
notification-test observation and inherited fixture follow-ups are resolved.


## First candidate CI failure

Candidate `5497153c5e09d310d53e63d7f029d26d78a21e23`, run 38587076865 attempt 1:
Windows 2022 job 115932477801 failed `npm run test:platform` at the existing
`windows-rename-diagnostics.test.mjs` raw `stress_legacy` case. Its allowlisted response
records one completed `fs.rename`, `renamed: false`, `nodeCode: EPERM`, `syscall: rename`,
no injected lock, identical start/end milliseconds. It does not identify an OS handle,
external actor or cause; this is not a Date mutation failure. Date runtime on that OS
was unreached. The original test still rejects this negative.

The four raw-stress cases passed locally on macOS, which cannot reproduce a Windows-only
permission result. Ranked hypotheses are transient legacy resolver/lstat access, external
runner access and fixture preparation/path interaction. No cause is established from
source inspection alone. A bounded `raw-rename` Windows 2022 route now retains the existing
idle/native/legacy/production-scan differential plus the original regression file. Assertion
failure context adds sanitized stress counters, overlap, resource and data invariants;
no product code, rename retry, raw-test expectation, deadline or cleanup gate changes.
Focused and full outcomes remain in the GitHub checkpoint.

The diagnostic-only follow-up passed local route/rename checks: 58 passed, zero failed,
three platform skips; lint, documentation links and diff checks passed. Both independent
review axes reported zero findings. This does not reproduce the Windows EPERM locally or
establish its cause. The original legacy rename-success assertion remains unchanged.


## Renewed CI routing fixture failure

Renewed full run 38591060169 on `f3f6093611ed8e60bbaf7259cc824f4e9868e34a`
failed the inherited `test-suites.test.mjs` exact guard and dispatch-option inventories:
the diagnostic route was added but these two consumers were missed. This is an agent
bookkeeping error, not a Date or platform behavior failure. The same original file
reproduced locally: 10 passes, two failures in less than one second. The observed expected/
actual differences directly establish stale fixture inventories; no speculative runtime
hypothesis or extra instrumentation is needed for this deterministic failure.

The expectations now include the authorized raw-rename route and the matching issue-24
focused route. All previous default/partition/original-command/failure assertions are
retained; explicit selector checks verify only the selected focused job runs. The new
`issue24-failures` command runs this scheduling file on all three OS and the original runner
startup/terminal cases on Windows 2022, retaining fail-fast=false, original exits via
pipefail and exact-SHA test-log artifacts.
Focused/full outcomes remain in GitHub; no integration is inferred from local repair.


Windows 2022 in the renewed run additionally failed the real `noisy` runner fixture startup:
the child exited 1 while publishing `started` because `current.json.tmp` replacement returned
EPERM. The original log has no handle attribution. A local pre-publication file-read probe
reproduced the overlapping-read pattern deterministically (19 snapshot opens; expected zero)
without claiming to reproduce Windows EPERM. The fixture parent now waits on a separate
worker publication marker emitted only after `phase` saved running; failed-startup state is
read after owned-worker termination. Production runner/save/observer code, ownership,
startup/exit deadlines and terminal assertions are unchanged. A system-file-read probe
checks this ordering and restores its patched builtin in finally. Real startup-exit,
stall/cleanup, delayed healthy startup and quiet/noisy/failure/throw cases remain required.
This removes the demonstrated fixture read/write overlap; the exact Windows OS cause
remains unproven until further evidence. No actual Ralphex executor is launched by these
controlled process fixtures.

The complete renewed local candidate passed `test:all`: 2,762 tests, 2,741 passed,
zero failures, 21 platform skips, using the unchanged application build. Focused observer/
routing checks passed 142; the nine original/new real-runner startup/terminal cases passed.
Lint, docs and diff checks passed. Both follow-up reviews found no behavioral/standards
issue; one stale route-description sentence was corrected. Aggregate outstanding findings
are zero (initial Standards duplicate and later Spec report wording are resolved).


## Windows latest category-checkpoint failure

Full run 38596368794 on `b516fb0c23bfe43018fb7e872e8e66da7cfcaa08` failed
Windows latest job 115964837245 in the inherited invalid-diagnostic-record control.
Downloaded `diagnostic-numeric` checkpoint shows grouped.restart failed, later recovery
cases unreached, only one utility started/exited, normal handshake and cleanup. Its
malformed-result injection erased the primary diagnostic even though that control was
not reached. The original OS/service restart cause is not recoverable from this checkpoint.

A controlled second-connect failure combined with numeric diagnostic injection reproduced
the lost primary record locally (red, 1.4 seconds). The fixture now corrupts a diagnostic
only after the intended injected recovery-result assertion is actually reached, preserving
earlier and real lifecycle failures. The controlled regression checks exact reconnect seam,
scenario reachability, one utility exit, normal handshake, cleanup and the persisted record.
No production service/controller, restart retry, deadline or existing assertion changes.
The new category-fixture route runs the original regression on Windows latest and retains
all finite checkpoints/logs. Focused/full outcomes remain in GitHub.

The repaired candidate passed a fresh build and complete local `npm test`: 2,764
tests, 2,743 passed, zero failures, 21 platform skips. The original category-fixture
file passed 45 tests; routing/diagnostics passed 35. Typecheck, lint, docs and diff
checks passed, and both follow-up reviews found no outstanding issue. The previous
full run's macOS and Windows 2022 jobs passed; Windows 2022 Date dev/package reports
and the RU narrow-window screenshot were inspected, with all EN/RU checks, ordinary
shutdowns and cleanup passing on that run's exact SHA. These partial platform
results do not constitute acceptance of the new candidate.

Focused Windows latest run 38611165614 passed all 45 original category-fixture
tests on `cbc83a681b6332de4dce51f05978ae86d905e3f6`; downloaded success, numeric
diagnostic and controlled reconnect checkpoints confirm their required reachability,
utility exit counts, handshake and cleanup. Renewed full run 38611841609 failed
Windows latest job 116017599263 in malformed-result. This time the primary record
was retained: grouped.restart / stop / lifecycle_failed, with one utility exit,
normal handshake and cleanup. The malformed-result injection was unreached.
This narrows the failure to stop but does not identify its underlying cause.

Fixture-only finite sub-seams now distinguish controller stop, owned-worker
termination and remaining ownership assertion. Two controlled real-Electron
stop failures first failed red and check these exact primary seams, fail-closed
reachability, normal shutdown and cleanup. No stop timing, kill behavior, production
controller, retry or success assertion changes. The existing category-fixture route
will run the original file before another full same-SHA acceptance attempt.

The same full run's Windows 2022 job 116017599849 passed platform tests but failed
`npm run smoke:runtime -- dev`: RU unavailable-category feedback at
smoke-project-category-move-ui.mjs:585 was not visible within the original 15 seconds.
Downloaded runtime observations confirm EN completed and RU failed at unavailable;
the underlying UI/service ordering cause is not established. The owned-fixture script
now retains state before submission and, on failure, after-state, editor visibility,
bounded table text and filesystem inventory without replacing the primary error.
The matching category-fixture selector also runs the original dev runtime command on
Windows 2022. The first diagnostic candidate retained the original single-message
expectation, input and timeout without an assertion waiver.

The updated original fixture/routing tests passed 61 before the extra runtime-route
test. The complete local suite including that route passed 2,767 tests: 2,746 passed,
zero failures and 21 platform skips. Lint, typecheck, docs and diff checks passed;
both reviews found zero outstanding findings. A concurrent local category runtime
attempt failed the existing 10-second ordinary Electron shutdown bound, with owned
forced cleanup confirmed. This is not a pass or proof of either Windows failure's
cause; an isolated runtime verification follows. Proof capture before the external
rename preserves the original rename → inventory → Enter sequence.

The isolated local category UI dev run passed EN/RU moves, rejections, unavailable
feedback, restart, all five controlled preparation/recovery checkpoints, ordinary
shutdown and cleanup. Evidence is retained under
`work/issue-24-category-runtime-local-isolated`. This verifies the current script
locally and does not establish the cause of the preceding shutdown or Windows failures.

The downloaded Windows 2022 failed screenshot subsequently established the actual
visible state: the exact RU source/project-changed warning with both editor and
submission disabled. Existing EN/RU renderer regressions explicitly require this
unsubmitted sourceObserved guard and zero mutations. The smoke's single unavailable
message expectation therefore rejected a valid production guard when observation won
the race. Production behavior is unchanged. The runtime oracle now distinguishes
the two existing outcomes: exact stale warning requires disabled editor/submit, zero
authored mutation IDs and unchanged durable journal; exact unavailable warning requires
one authored UUID. Both require unchanged post-rename filesystem inventory and exact
selected-project/Text preservation. Evidence records the outcome and before/after state.
The new guard regression rejects submitted stale actions, enabled stale controls,
absent/duplicate/malformed unavailable submission IDs; the focused renderer/runtime
suite passed 221 tests. This screenshot establishes the UI expectation mismatch;
it does not explain the separate Windows latest stop failure.

Focused run 38615644574 passed on `86b9f0671657f48e8d3cdb5953db39502e3b7a88`:
Windows latest original fixture 47/47 and Windows 2022 original dev runtime. Downloaded
success/stop-control checkpoints and the exact-SHA category runtime report confirm
EN/RU completion, 34 shutdowns and cleanup. The refined guard oracle then passed the
full local suite: 2,768 tests, 2,747 passed, zero failures, 21 platform skips. Lint,
typecheck, docs and diff passed. Isolated actual category UI dev runtime passed all
EN/RU operations, recovery, restart, normal shutdown and cleanup with proofs under
`work/issue-24-category-guard-local`. Reviews have zero outstanding findings: the
Spec review caught a full-tree assertion placed before restoring the owned absent
category; it now runs after restoration/refresh, with exact project/Text and
post-rename inventory checks retained while absent. New matching focused/full CI
is required for this final oracle change before integration.

Focused run 38617014757 passed on `e65738802e013018838c4aba22bda2c9bb31813b`:
47 original Windows latest category tests and the original Windows 2022 dev runtime.
Downloaded exact-SHA category report, both unavailable-operation proofs and fixture
success checkpoint confirm one authored unavailable UUID per language, no effects,
34 normal shutdowns, cleanup and 4 utility exits. Full run 38618003758 then failed
Windows 2022 job 116038704972 in inherited DELETE-shared contrast test at
windows-rename-diagnostics.test.mjs:355. Its log records only status failed vs
completed and lacks the finite operation response; exact underlying cause is unknown.
Windows latest passed platform tests; remaining runtime jobs are still pending.

The contrast assertion now includes the existing allowlisted parseFixtureResponse
checkpoint, and separately requires failed evidence to remain parseable. Actual
rename success and verified handle lifetime remain mandatory; no retries, deadline,
native API or production behavior changes. The existing Windows 2022 raw-rename
focused route runs the original file and bounded differential diagnostics before
another full same-SHA acceptance run. Improved failure context is not a causal fix.

The same full run's macOS job 116038705027 passed platform tests but failed original
dev runtime at grouped RU current-name rename: the unchanged message did not appear.
Downloaded screenshot shows a completed rename, and the bounded submission receipt
establishes editorMatchesDraft=false, requestMatchesDraft=false, serviceOk=true,
outcome=completed and responseMatchesDraft=false. The driver submitted different
authored text before its timeout; this is not evidence of a broken service no-op.
The exact cause of draft divergence is not established by the receipt.

The fixture driver now uses native select-all/Backspace to clear the old name, checks
empty input, fills the exact intended draft and requires equality before Enter. It
never retries a service mutation or edits the production DOM/state directly. A
controlled divergent-input regression failed red first and requires no mutation on
divergence. Original expected messages, no-op outcome and project/file preservation
remain unchanged. Focused readiness/receipt/runtime checks passed 34 tests. The
raw-rename route now independently retains the original failed dev runtime command
on macOS alongside Windows 2022's original diagnostic file/comparison.

The subsequent complete local suite also found an inherited observer CLI cancellation
fixture race: after a fixed 100ms, SIGTERM could arrive before cancellation handlers,
leaving empty stdout and failing JSON parsing. A controlled 250ms real CLI startup
delay reproduced that same failure red. The fixture now waits for the actual owned
cursor lock published after handler installation, before SIGTERM, and observes close
so stdout has drained. Its controlled executor is gated until cancellation assertions
finish, then released to its required successful terminal state. Immediate and delayed
CLI startup cases passed; production observer/runner and shutdown assertions are
unchanged. No actual Ralphex executor is launched. The matching focused macOS job
retains these original cancellation cases even if its independent runtime step fails.

The combined follow-up candidate passed the complete local suite: 2,771 tests,
2,750 passed, zero failures and 21 platform skips. Original Windows diagnostics
passed 37 with three platform skips. Lint, typecheck, docs and diff checks passed.
Actual isolated rename dev UI passed direct/grouped exact authoring, unchanged/rejected
outcomes, Text/inventory/identity preservation, sibling/native Reveal and all seven
interruption/restart scenarios per mode; evidence is retained under
`work/issue-24-exact-rename-local`. Reviews have zero outstanding findings. They caught
and resolved an initially misplaced contrast-context edit and an outdated Windows-only
route sentence. Full run 38618003758 finished with Windows latest passing completely;
macOS draft divergence and Windows 2022 contrast failures remain mapped above.
Matching focused checks precede full acceptance of this new candidate.

Focused run 38622211849 on `563fef74cd4f873d47ea2d66556ede734a5e7d8f`
failed macOS job 116052307128 before mutation: the new empty-input assertion
observed the old name minus its last character after Select All/Backspace. The
accelerator did not select the text in this runner; why it was ineffective is not
established. Both immediate/delayed actual CLI cancellation cases passed on macOS.
Windows 2022 comparison/original regression outcomes remain pending.

A controlled ineffective-accelerator regression reproduced the same clear failure
red. The driver now uses Playwright's standard locator selectText action, then
Backspace, retaining empty-input and exact-draft assertions before Enter. There is
no script-injected value/focus, alternate accepted message or mutation replay.
The real-platform focused command remains required before full same-SHA acceptance.

The focused Windows 2022 job in run 38622211849 passed all 40 original diagnostic
tests without skips; downloaded comparison evidence passed all 32 operations with
data invariants, confirmed termination and cleanup, retaining native negative
responses rather than turning them into successful renames. This does not identify
the historical contrast cause. The selectText follow-up passed 34 focused tests,
the full local suite (2,750 passed, zero failures, 21 skips), lint/docs/diff and both
reviews. Actual isolated rename dev UI also passed all direct/grouped scenarios,
exact input/no-op/rejection, native Reveal, preservation, seven interruption/restart
cases per mode, shutdown and cleanup under `work/issue-24-select-rename-local`.


Focused run 38623576129 on `eba0aab88064f471bbf0a11768c79a7d1aa2894f`
failed both affected jobs. macOS job 116056971751 again failed before submission:
selectText/Backspace left `  Renamed 日本` instead of the required empty input.
Windows 2022 job 116056972433 failed only original `stress_scan`: one Node rename
returned EPERM, while 12 scans were ready, service observers were closed and all
data/restart/cleanup invariants passed. The finite original response is retained;
neither historical OS actor nor macOS selection-loss cause is established.

A real Electron control collapses the selection between separate locator actions.
`node --import tsx --test --test-name-pattern='exact rename authoring'
tests/rename-editor-readiness.test.mjs` failed with the same truncated name in
2.6 seconds before repair. Clearing now uses one ordinary locator fill of the
empty string and checks it before filling/checking the exact draft; Enter remains
separate. The control passed in 2.2 seconds, and the editor/runtime focused files
passed 32 tests. Date service tests on Node 22.21.1 passed 7 tests. No production
renderer/service mutation, alternate outcome or filesystem replay was added.

An additional Windows-only directory-enumeration contrast uses separate owned
fixtures, one original rename each, and a finally-closed held stream. It compares
an open category opendir stream with completed buffered readdir enumeration,
retaining sentinel bytes and finite operation details. Actual Windows evidence is
required to validate the predicted handle conflict; this local platform skip is
not cause evidence. Original legacy and production-scan rename-success assertions
are unchanged. Both follow-up reviews report zero findings. Lint, typecheck, docs
and diff checks passed. Matching focused runtime/Windows original checks remain
required before full acceptance and integration.


Final local follow-up suite on Node 22.21.1: 2,773 tests, 2,751 passed,
zero failures and 22 platform skips (including the new Windows contrast).
Actual isolated rename development UI passed all direct/grouped EN/RU authoring,
no-op/rejection, preservation, native Reveal and seven recovery/restart cases per
mode; all 46 shutdowns and fixture cleanup passed. Evidence is under
`work/issue-24-fill-rename-local`. Reviews remain at zero findings; Windows
contrast and original focused outcomes are still required on the new candidate.


Focused run 38626264952 on `7a23c865cf0aa223b6b8cceec77475f7b931bf26`
passed the original macOS dev runtime and CLI cancellation cases. Downloaded
exact-SHA rename report confirms complete EN/RU direct/grouped acceptance,
46 normal shutdowns and cleanup; category report confirms 34 shutdowns/cleanup.
Windows 2022 passed the bounded comparison and all 40 original tests, but the
new enumeration contrast failed: held category opendir still permitted its
single rename. The predicted opendir conflict is therefore falsified, not a
production repair finding. The historical scan EPERM actor remains unknown.

The new diagnostic's incorrect rejection expectation was reproduced locally by
running the same case on macOS (one test failed in 0.24 seconds). The contrast
now requires actual rename success in both independently owned held/buffered
fixtures, retains finite responses, sentinel bytes and finally-closed handles.
No original assertion is relaxed. A default-false raw_windows_only dispatch flag
focuses only the remaining Windows job after the unchanged macOS source passed;
ordinary/full matrix behavior is unchanged and has an explicit route regression.
The corrected Windows contrast/original suite is required on the new SHA before
renewed full acceptance of that SHA.


Final corrected local candidate on Node 22.21.1: 2,774 tests, 2,753 passed,
zero failures and 21 platform skips. The cross-platform contrast passed both
held and buffered single renames; routing passed 17 tests. Lint, typecheck,
docs, diff and both follow-up reviews passed. Only Windows focused original
suite/contrast is newly required before full same-SHA acceptance; the already
inspected macOS focused source is unchanged.


Full run 38628352818 on `1f671e86af5760b5593b5c63625e8fb70a150567`
completed: common, macOS and Windows 2022 passed. Windows latest job 116074067110
failed two platform tests: category fixture invalid-diagnostic control at line289
found a retained diagnostic instead of the expected malformed-control result;
readiness cleanup-control validation received a page.setContent 30s timeout
instead of its deliberate cleanup error. The saved diagnostic-success checkpoint
retains initial fixture/connect/lifecycle_failed, all scenarios unreached, one
utility exit and normal handshake/cleanup. Injection was unreached, not accepted
as a successful malformed control; the original assertion lacked finite context.
Actual initial-connect cause and renderer timeout cause remain unproven.

Controlled pending fixture navigation erased the mounted editor (count0 rather
than1) in 1.7s. The readiness helper now waits for its app-owned load promise
within the original firstWindow 30s budget before caller mounting; a fixed-delay
control passed in 1.2s. The cleanup-only test no longer mounts unrelated DOM;
a controlled mount error reproduced the exact primary-vs-secondary validation
failure red in 1.9s before this removal, then passed in 1.9s. Temporary mount-error
injection and failed throwaway startup probes were removed. Existing primary,
secondary, process-exit/profile-removal assertions remain.

An owned directory at the controlled SQLite database path reproduces an initial
service-open failure before diagnostic-success injection. Before repair its
substage was lost as generic connect; the single-test loop was red in 0.86s.
Finite allowlisted connect stages now read the real controller status after
failed start, retaining connect_service_open or connect_readiness_timeout rather
than any thrown text. The loop passed in 0.88s with one utility exit and complete
normal handshake/cleanup. Original start still has its 6s limit; original
malformed-control assertions now include the sanitized checkpoint when failing.
This is improved diagnostic evidence, not attribution of the historical startup
actor. The matching issue24-startup route independently runs both original files
on Windows latest before renewed full same-SHA acceptance.


Both reviews identified that a fixed 200ms navigation delay could produce a
false green on a slow runner. The final control instead gates its real second
navigation on the first read of the fixture-owned promise: before repair that
read occurs after mounting and always erases the editor; after repair it occurs
before mounting. With only the awaited-load lines removed, a diff against the
pristine candidate confirmed the mutation and the control failed count0 vs1 in
1.6s. Restoring those lines passed. No timer, manually injected DOM value/focus
or changed production predicate is used by this control. Original readiness
allowances remain; the old speculative delayed-first-navigation probe was removed.
The first combined local file run also correctly caught inputDigest drift while
I was editing the fixture. Source was then frozen for renewed complete verification;
that mismatch is not a production or hashing defect and no digest assertion changed.


Final frozen local startup candidate on Node 22.21.1: 2,778 tests, 2,757 passed,
zero failures and 21 platform skips. Routing18, lint, typecheck, docs and diff
passed. Both reviews have zero outstanding findings after the timer-based
regression was replaced with the deterministic real-navigation gate. Required
Windows latest focused original-file evidence and renewed full same-SHA acceptance
remain before integration; no production runner/service deadline or predicate changed.


Focused run 38632952532 on `2a6910712834d56de6cec96558cabf4380029af1`
passed the complete readiness file, but category had 48 passed/1 failed:
original service cleanup control expected main exit0 but observed1. Its checkpoint
retains grouped.restart / stop_count / lifecycle_failed, one utility exit and all
later recovery scenarios unreached; final_cleanup is the deliberately injected
cleanup failure. It did not reach the intended successful-service cleanup seam.

The owned waiter resolved its Promise at timer expiry, before checking real exit.
Extracting the unchanged call-site wait into the fixture's shared helper produced
a deterministic red clock test: at the original1000ms expiry, expected rejection
was missing (0.18s loop). Expiry now rejects, removes its listener, preserves the
original final kill attempt and cannot be promoted by a late exit event. At that
same deadline a non-signaling probe of only the captured owned PID records the
finite running/stopped/unknown state. Even a stopped process without its required
exit event remains failure. Controlled expiry/actual-exit/private-probe regressions
pass; original start/stop deadlines, scenario/count/exit/cleanup assertions remain.
The historical OS actor/notification cause is still unknown. The category-only
focused flag narrows the existing startup route after inspected unchanged
readiness success; full acceptance still follows only on that same repaired SHA.


Final owned-wait candidate on Node22.21.1: 2,780 tests, 2,759 passed, zero
failures and 21 platform skips. Routing18, lint, typecheck, docs and diff passed;
both reviews have zero findings. Source remained frozen during this complete run.
The original Windows latest category file is required next; readiness source is
unchanged from its inspected focused success. No claim is made that the historical
Windows stop actor is fixed by better deadline semantics or evidence.


Full run38636598781 on `dcdc4c3ddb930134ef341c09fd7d6088a4f24873`
Windows2022 job116102080524 failed only the new real navigation regression:
page.setContent reported Execution context was destroyed, most likely because of
a navigation (0.68s), after main's load receipt. All other platform tests passed.
Main and Page delivery use separate transports; main receipt alone did not prove
Page context readiness. The completed full failure map is retained below.

A coupled main/Page control reproduced the exact destroyed-context error after
the real helper consumed a completed main receipt (0.52s loop). Main-owned
fixture URLs are now distinct encoded data URLs for initial/controlled navigation,
and the same helper awaits that exact Page URL with waitUntil load before mounting.
FirstWindow, main receipt and Page load share the original30s allowance; no retry,
mount replay, injected DOM value/focus or extended timeout is added. The coupled
and actual Electron navigation controls passed. The existing readiness selector
has a default-false Windows flag to match both affected original failed files;
original focused result/artifact inspection still precedes full acceptance.


The same full run's Windows latest job116102080308 failed only that identical
navigation regression/destroyed-context error. Category and all other platform
files passed. The readiness focused flag therefore selects both affected Windows
OS, preserving independent original results and distinct OS/SHA/run/attempt logs.
Default macOS and ordinary/full coverage remain unchanged.


The same full run's macOS job116102080249 failed only grouped packaged
creation/native evidence. The receipt proves native verified → reply dispatched
(245.9ms) → service rejected/unavailable (267.5ms); Finder separately selected the
exact target in405ms. Native latency132ms rules out the adapter deadline. The
post-native service authorization is the failure boundary; the historical actor
and exact scan state are not present in that receipt and remain unknown.

The exact original local packaged command passed with an owned, finite temporary
scan-state probe. A public real-SQLite/real-filesystem control then reproduced
service rejected/unavailable after native dispatched in0.32s: owned ordinary
metadata files were created during the post-dispatch scan. Both direct/grouped
cases failed; the probe retained only scan.state changed. No target identity,
policy or authored sentinel changed. This establishes the failure mechanism,
without attributing the historical CI actor to Finder metadata.

The request now retains the last successful full authorization's persisted
bindings. Only a changed scan after actual native dispatched can acknowledge the
call across that instability, and only when all those bindings remain identical
and fresh physical root/category/selected-target identity/accessibility pass.
Pre-dispatch scans and permit reauthorization stay strict, with no retry, altered
scanner policy or deadline. Dirty-scan controls reject changed exclusions, retained
associations, workspace source rebinding, unavailable category, missing/replaced
target; unchanged authority/target acknowledges the actual command. Original
post-target, policy, duplicate/ownership/reservation, cancellation and permit
regressions remain. Temporary DEBUG instrumentation was removed before review.
Reveal77 and CI routing19 passed locally (96/96). The focused union retains both
Windows original readiness files plus the macOS exact packaged command. Both
actual focused success and subsequent full same-SHA evidence remain required.


Final frozen acknowledgment/navigation candidate on Node22.21.1: 2,797 tests,
2,776 passed, zero failures and21 platform skips (113.4s). Fresh production build,
package and release artifact check passed. Exact local original grouped packaged
creation command passed RU acknowledgment, Finder exact target, restart persistence,
both normal shutdowns/backend stop and owned fixture removal, with no skips:
`work/issue24-reveal-ack-local/release-creation-observations.json`. Lint, typecheck,
docs and diff passed. Both review axes have zero findings; required focused/full
CI and integration remain in the GitHub checkpoint.


Full run38641861932 on `c0886707` Windows2022 job116119603175
failed only the new Reveal controls: direct/grouped excluded controls observed
dispatched, direct retained observed unresolved instead of unavailable, and both
predispatch dirty controls observed dispatched. Real file creation did not force
the expected changed scan on this OS; visible timestamps were not captured in
that run, so delayed timestamp delivery is a hypothesis, not historical proof.
Other OS results are retained separately once complete.

A public real-SQLite control with fixed directory timestamps reproduced the
excluded-policy stale success on both modes in0.36s. The policy was changed from
an owned filesystem call while targetFor retained earlier source policy, and the
authorization fingerprint was previously taken only after its checks. Capturing
it before validation and requiring the same persisted bindings afterward now
rejects unresolved. This also protects successful stable scans; no dirty-scan
fallback is involved. The dirty tests now pin changed timestamp observations
monotonically while still performing the same real owned file writes; native
identity, realpath, enumeration, access and sentinels remain real. Exact outcomes
and original zero-native-call assertions are unchanged. New stable-scan controls
and the entire Reveal79/routing20 suites passed99/99. No deadline or production
scanner policy changed. Required Windows original-file and macOS exact packaged
focused acceptance still precede renewed full same-SHA acceptance.


Spec review found a further P2: the dirty-scan fallback compared persisted
authority before final physical checks, but not afterward. Its independent owned
real-SQLite/native-filesystem reproduction changed exclusions only during final
fallback access and incorrectly acknowledged dispatched in both modes. The
permanent public settings-service regression also went red in0.32s with exactly
one owned metadata write and confirmed late policy change. Fallback now requires
the same persisted bindings after final target verification as well. The added
before/after guard prevents acknowledgment after that authority change; target
evidence/access remains real and original deadlines/assertions unchanged.


Full38641861932 completed: common and macOS passed. Windowslatest
job116119603311 passed all platform files, then original direct development
creation/native failed0vs1 selection. Its downloaded receipt shows OPEN1,
READY unreached, valid service rejection native_unavailable after12039ms,
no select/return and exactly one owned bridge started/stopped with confirmed
cleanup. The finite script failure marker was absent; this records owner expiry
while waiting past OPEN, not proof of a particular COM call or OS actor.

The owner deadline had no failure-state event. Controlled original12s timer
expiry was red missing diagnostic in initial/opened/authorizing states (0.14s).
Expiry now retains its finite last protocol state and owner_deadline reason,
including timer, live-clock and close-time checks. Native rejection, sole owned
kill, absent/late GO prohibition and unknown termination remain unchanged. The
smoke retains only that allowlisted state/reason. Existing unknown-termination
assertion now includes the added diagnostic while still requiring unknown state.
The focused union includes both original Windows Reveal files/bridge regressions,
Windows latest exact direct dev creation command and macOS exact grouped packaged
command. No deadline, permit/view guard or original native assertion is waived.

Local frozen authority candidate before the deadline-marker addition passed
2,802 tests/2,781 passed/zero failures/21 platform skips (110.2s). Its first local
packaged creation attempt failed form-open before native while I concurrently
started other Electron tests; that overlap did not provide isolated UI evidence.
After tests stopped, the exact packaged command passed native/RU acknowledgment,
exact Finder target, restart, two normal shutdowns and owned cleanup, no skips:
`work/issue24-authority-ack-isolated/release-creation-observations.json`. The
execution order changed; no form assertion/deadline or retry loop was added.
Historical cause of that first form-open timeout remains unproven. Both reviews
closed the authority P2; final marker candidate verification is renewed below.


Final frozen authority/expiry-marker candidate on Node22.21.1: 2,806 tests,
2,785 passed, zero failures and21 platform skips (108.1s). Fresh build,
package/artifact check, lint, typecheck, docs and diff passed. Exact original
local grouped packaged creation passed native/RU acknowledgment, exact Finder
target, restart, two normal shutdowns and owned cleanup with no skips before
the full tests started: `work/issue24-marker-ack-isolated/release-creation-observations.json`.
Both complete review axes have zero outstanding findings. Required focused
Windows original-file/native and macOS packaged evidence precede full same-SHA
acceptance; integration/closure remain in the GitHub checkpoint.


Full38645981450 on `11fbfa87` completed: common, macOS and Windows2022
passed their full suites/native/runtime/packages, including both Date modes.
Windowslatest passed all platform tests and its layout/crash prefix, then failed
the exact direct development native command0vs1. Downloaded receipt retains
opened/owner_deadline, OPEN1/READY0/select0, valid native_unavailable after
12039.5ms, one confirmed owned bridge stop and fixture cleanup. The expiry
marker is now present; it does not establish the blocked COM call or OS actor.

The isolated focused command had passed on both prior candidates. The focused
loop now includes the original UI/layout/crash predecessors rather than treating
that isolated command as a sufficient reproduction of the full-call pattern.
Optional first-visit bootstrap and read-boundary probes distinguish assembly/
compile/shell/open/enumeration/document/parent/owner/UIA/readiness/item checks.
They contain only allowlisted labels and finite receiver elapsed times, are
deduplicated15 maximum and stay inside the original1024-byte protocol bound.
Trace frames cannot advance the permission state, repeat, appear after READY or
carry unknown/private labels; failures still reject and kill only the owned
bridge. Observer callback faults cannot replace a real query failure. Normal
tracing is disabled; the focused native command opts in without changing target,
GO, view/identity/ownership guards or any deadline. The initial trace replay was
red native_error in0.15s before the bounded protocol extension; trace/invalid/
late-frame controls passed locally. Windows interpreter proof and contextual
original native evidence remain before any renewed full acceptance.


Final frozen boundary-probe candidate on Node22.21.1: 2,813 tests, 2,791
passed, zero failures and22 platform skips (107.9s). Fresh build, package/artifact
check, lint, typecheck, docs and diff passed; exact isolated local grouped
packaged creation/native command passed with no skips before tests started:
`work/issue24-boundary-mac-isolated/release-creation-observations.json`.
Both review axes have zero findings. The additional skip is the new Windows
actual-interpreter trace control; it must execute on both focused Windows jobs.
This candidate adds diagnostic/context coverage, not an asserted historical
native cause repair. Windows original contextual native evidence remains open.


Contextual focused38651166252 on `73b04f00` passed both Windows original
regression/actual interpreter files, all original layout/crash predecessors and
macOS original packaged command, but reproduced exact Windowslatest native0vs1.
Downloaded first-received trace: assemblies189ms, compile247ms, shell312ms,
open338ms, enumeration784ms, then opened/owner_deadline. No document/owner/UIA
boundary was reached in the first observed path. This disproves slow bootstrap
and first UIA-query hypotheses for this reproduction. The remaining box spans
Shell.Windows(), collection Count and Item before document acquisition; two
additional fixed boundaries distinguish collection receipt from Item entry.
They increase the bounded unique labels from15 to17, still under the unchanged
1024bytes/12s, and do not alter enumeration, count or item guard behavior.
Historical repeated-poll call timing remains unproven; contextual native failure
is now reproduced rather than replaced with isolated green evidence.


The two-label intermediate diagnostic passed fresh build, lint, typecheck,
docs/diff and affected trace/static-COM/routing checks79/79 with4 explicit
Windows skips; both scoped reviews have zero findings. Previous complete
2813-test evidence is retained, not claimed as a new full run. No operation,
policy or deadline changed. Final repair will renew its required full evidence.


Focused38653944953 on `6d8f1595` passed both original Windows regression/
actual PowerShell files (226/226 each without skips), contextual Windowslatest
Ladle/layout/crash predecessors and its original direct native command, plus
the original macOS grouped packaged command. Downloaded native evidence retains
one exact navigation/selection, returned/dispatched receipt, independent COM/UIA
agreement, restart, two normal exits, one confirmed bridge stop and fixture cleanup.
The native reply boundary was approximately6.7s; observation-only label changes
are not asserted as a repair of the historical COM expiry actor. Renewed local
full evidence on that exact SHA:2813 tests,2791 passes,0 failures,22 platform skips,
113.7s; lint/type/docs/diff passed. Full38654899485 then reproduced Windows2022
original stress_legacy: one fs.rename EPERM during4235 successful resolver calls,
closed service/resources zero and all data/restart/cleanup invariants true.

Both independent failure reviews found no demonstrated fixture repair seam or
historical OS-handle attribution. Current CI keeps legacy rejection as failure;
a proposed owner-only diagnostic expectation change is not applied. The default
remains strict diagnosis. A temporary owned-fixture Kernel-File experiment wraps
four original single-rename fixtures, exports no paths/raw ETL, and retains a
finite event window. Review identified lifetime and recycled-identifier/retention
errors in the first prototype before publication. Repairs add an autonomous15s
collector bound, explicit verified stop, IRP begin/completion retirement, unrelated
FileObject retirement, zero-identifier rejection, actual Status/issuing-thread
fields and separate128/96/32 event queues. Actual PowerShell controls replay the
unretired defect then require its absence and retain rename events despite a
300-event postrename flood. Local syntax/lint/routing checks passed22 tests with
one explicit new Windows interpreter skip; Windows execution and original raw
checks remain required. This is intermediate instrumentation, not final full-suite
or causal-repair evidence. Exact-SHA outcomes stay in GitHub.


Full38654899485 on6d8 passed complete common/macOS/Windowslatest; the only
failure was Windows2022 raw legacy stress. Downloaded Date dev/package JSONs and
screenshots on both passing OSs verify the exact SHA, all EN/RU/calendar/timezone/
invalid/clear/sibling/restart checks, three normal quits and cleanup. Eight original
direct/grouped dev/package native reports on those OSs verify exact target, acknowledgment,
restart, two normal exits and cleanup. Windows2022 Date stages were unreached.

Focused38657762876 on929 passed the actual PowerShell correlation/retention
controls, all original bounded comparisons and the unchanged strict raw regression.
Its temporary ETW step failed with collector unavailable/stop unverified and no
kernel events. Four legacy and four production-scan comparisons succeeded; three
raw-native negatives remain EPERM with cleanup. This does not explain the original
legacy refusal. The probe previously masked confirmed rename process evidence when
its separate stop failed; it now retains the real result independently. Collector
startup uses documented create-trace/run-for then owned-set start/stop/delete,
exports finite command status/code/hex and owned UUID, and requires stop/delete
before raw cleanup. Parser failures retain only phase/type/Hresult, and absent
event evidence stays a probe failure. Actual collector-set lifetime/availability
is a new Windows diagnostic gate, not a product repair or full acceptance finding.


The collector-set follow-up passed local syntax/lint/type/docs/diff and the22
routing tests with one actual-Windows control skip. Both independent reviews
closed the initial lifetime/parser findings and the follow-up uncertain-create/
trace-discovery findings. Teardown attempts stop/delete after any unique owned
creation attempt; all collector commands must have confirmed termination before
raw removal. Trace/fixture cleanup errors are finite and cannot erase the original
rename response. No new full local or actual collector evidence is claimed.


Focused38658954709 oncfc passed actual PowerShell controls, original comparisons
and the unchanged strict regression. Its owned collector set create/start/stop/
delete all returned0 with confirmed termination and trace/fixture cleanup. The
reader remained unavailable without a process outcome, so no handle evidence or
historical cause is established. Fresh local build/full suite on that SHA found
one missed raw-command inventory assertion (2814 tests,2790 passes,1 failure,
23 platform skips,108.7s); no complete local success is attributed. The dependent
workflow inventory now includes the two diagnostic commands and tests control/
build/cancellation gating while preserving independent original failure checks.
The scoped routing/product/parser files passed43 tests with one Windows skip.

The next intermediate probe retains finite reader process status/termination/code;
it does not mislabel successful FileObject/IRP hex values as errors. Full decode
and a provider/time-filtered reader use the same ETL and decoder, each under the
unchanged10s bound, in alternating order across fixtures. Only the native query
changes. Missing older associations, truncation, millisecond timing and event loss
remain unverified; no absence/actor inference is authorized. The actual interpreter
control checks query arguments and equal in-window decoding; real ETL execution
remains pending. Unknown reader termination blocks further readers and raw cleanup.
Both reviews report no findings. No product, original assertion or budget changed.


Focused38660535060 on180 passed actual PowerShell controls, original comparisons
and strict raw regression. The full reader timed out with confirmed termination;
the window reader completed but returned query/unavailable with CLR Hresult
-2146233088 and unknown type. All four collector commands returned0; owned trace
and fixture cleanup completed. No kernel attribution or historical cause follows.
The same SHA passed a fresh local2814-test suite (2791 passes,0 failures,23 platform
skips), package/artifact verification, original macOS grouped packaged native
command, lint/type/docs/diff. Both reviews had zero findings.

The next temporary probe exports an allowlisted query ErrorId and adds one
clock-only reader before the differential pair: at most64 records, aggregate
Kernel-File count and first/last time relative to rename, no event rows or host
identifiers. All three readers retain the existing10s individual bound. Unknown
peek termination prevents subsequent reads and raw cleanup. This distinguishes
query failure and retained clock-window evidence without attributing a handle
owner or claiming event absence. Both independent reviews requested corrected
reader-count/order metadata, now recorded. Actual Windows execution is pending.


Focused38662232364 on3d0 passed actual PowerShell controls, all original
comparisons and strict regression. The owned collector lifecycle and cleanup
passed; clock peek found63 Kernel-File records in64, at -640 through -227ms.
Full decode now completed with160 owned-path/window events, while the native
provider/time query on the same ETL returned NoMatchingEventsFound. This
falsifies a missing collector or absent retained window as the explanation for
this query result, without resolving historical rename refusal. Full-reader
timeout remains demonstrated only on180.

Ranked query hypotheses: (1) native hashtable time conversion loses subsecond
precision; (2) ProviderName differs from decoded ETL identity; (3) other native
time filtering differs from decoded TimeCreated. Primary PowerShell source
HandleStartTimeHashValue converts each operand via ToString before DateTime.Parse:
[GetEventCommand.cs](https://github.com/PowerShell/PowerShell/blob/master/src/Microsoft.PowerShell.Commands.Diagnostics/GetEventCommand.cs).
This is source evidence, not yet proof of installed Windows PowerShell behavior.
The next actual interpreter control invokes the installed private hashtable builder
and requires DateTime operands to lose the original end millisecond, then round-trip
strings to preserve both exact bounds. The probe changes only timestamp operand
representation, retains ProviderName and the shared decoder/window. Baseline also
retains its filtered finite events (256 per reader) rather than only their count,
allowing positive event inspection. Privacy, lifecycle, reader bounds and original
rename assertions remain unchanged. No actor claim or actual-Windows success for
this change is made. The unpublished provider-removal probe was replaced before
dispatch because primary source evidence supports a narrower precision seam.


Focused38663294417 ond991 passed installed PowerShell builder red-to-green,
actual correlation controls, original comparisons and strict regression. Collector
lifecycle/cleanup passed. Peek found63 Kernel-File records at +14..+15ms, yet the
precision-preserving native provider/time query still returned NoMatchingEventsFound;
full decode timed out with confirmed termination. Timestamp precision is a proven
reader defect, but insufficient to explain or repair the complete query failure.
Fresh local evidence on d991:2814 tests,2791 passes,0 failures,23 platform skips,
110.1s; lint/type/docs/diff passed. No historical rename cause is attributed.

The next one-variable probe removes only native ProviderName, retaining exact
round-trip time operands, installed precision controls and the decoder's exact
provider/path/window guards. The query control requires no native provider key.
This tests the second ranked query hypothesis without broadening exported data,
changing deadlines or accepting missing events. Actual Windows proof is pending.


Focused38663900630 onff23873 passed actual precision/correlation controls,
original comparisons and strict regression. Collector lifecycle/cleanup passed.
Time-only query still returned NoMatchingEventsFound; full reader timed out with
confirmed termination. Oldest clock sample contained63 Kernel-File records at
+127ms, beyond the actual1ms rename plus25ms window. Native provider removal
alone is insufficient; this comparison cannot isolate provider filtering when
the sampled retained interval is already outside the query window.

Ranked retention hypotheses: (1) late collector stop permits circular overwrite
of the early rename interval; (2) kernel timestamps differ from worker clock;
(3) native time-query semantics differ despite preserved precision. The next
probe changes only collector stop trigger. An owned rename-worker close schedules
stop via setImmediate after original completion/signal microtasks; it does not
await teardown in the original rename path, shorten the resolver's one-second
loop, repeat rename or change stress overlap. Fixture-finally awaits the same
owned stop promise (fallback if the close was not observed), then deletes the
owned set before parsing/cleanup. Finite stop trigger/request/settled timestamps
allow inspection. All prior collector/reader/event limits remain. Clock samples
are incomplete and do not prove loss/absence/handle actor. Actual Windows evidence
for the earlier stop is pending.
