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
