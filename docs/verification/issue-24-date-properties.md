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
