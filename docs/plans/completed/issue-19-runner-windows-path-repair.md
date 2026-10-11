# Issue #19: Bounded Windows Observer Path and Timeout Repair

## Overview Repair observer path identity using the runner’s synchronous canonical representation, then diagnose and repair the Windows diagnostic timeout regression. Preserve authorization, output safety and truthful failure evidence. Intended plan path: docs/plans/issue-19-runner-windows-path-repair.md.

## Context

- Branch: codex/issue-19-category-move; clean checkout.

- HEAD: 0305def0b276f88c148dcb42605eb496a2cc53be.

- Immutable issueBaseSha: 4f9f11f785c63a65585ea6f33f167fc438272c64.

- lastReviewedSha: 1b33ee88f858653e0e9eec43de61f90e7020dce0.

- Existing planning configuration selects gpt-6.1-sol/high for planning, execution and review. Preserve it and global settings.

- Applicable rules: AGENTS.md, docs/development.md, docs/ralphex.md and do-task-ralphex/references/issue-flow.md. Use Matt Pocock TDD and diagnosis at the already authorized public boundaries.

- Primary diagnosis: work/issue-19/windows-observer-path-repair/diagnosis.json.

- Inspected Windows evidence: work/issue-19/actions-38181153187-observer-inspected.json and both diagnostic.json artifacts beneath work/issue-19/actions-38181153187-observer-artifacts/.

- Run 38181153187, attempt 1, at HEAD reproduces synchronous/asynchronous realpath string inequality in both current_process and owned_child cases on windows-latest and windows-2022. PID probes are allowed; other identity fields match; observe returns ownership_unknown.

- scripts/ralphex-run.mjs records realpathSync directory identities. scripts/ralphex-observe.mjs selects directories using asynchronous realpath and compares strings strictly.

- Separate timeout failure: work/issue-19/actions-38181153187-observer-2022-clean.log, lines 1077–1094; tests/windows-observer-diagnostics.test.mjs:229 reads missing owned-child.pid. The raw Windows --import path hypothesis remains unproven.

- Preserve the original 78/79 terminal-state failure and work/issue-19/observer-terminal-diagnosis/diagnosis.json. Its cause remains unproven.

- Imported runner, completed service work and receipts are complete. Task 2 category-fixture diagnostics in the previous diagnostic plan remain untouched and deferred.

## Development Approach

- Use Node 22.21.1, existing Node tests, disposable fixtures and existing diagnostic scripts. No new dependencies or framework.

- Test seams: public observe API and public windows-observer-diagnostics CLI with persisted finite evidence.

- Implement one failing behavioral regression and its minimal repair at a time. Task 1’s new regressions and affected guard checks must pass before Task 2.

- Do not change product, native, service or UI behavior; global skills; completed receipts; trackers; coordinator snapshots; or terminal-race policy.

- Planning emits this draft only. No file write, implementation, commit or publication occurs in this invocation.

## Implementation Steps

### Task 1: Align observer canonical paths while preserving ownership and output guards

Files:

- Modify: scripts/ralphex-observe.mjs.

- Modify: scripts/windows-observer-diagnostics.mjs.

- Modify: tests/ralphex-observe.test.mjs.

- Modify: tests/windows-observer-diagnostics.test.mjs.

- Modify: docs/ralphex.md.

- Exercise unchanged: scripts/ralphex-run.mjs and tests/ralphex-run.test.mjs.

- [x] Add public observe regressions using synchronously prepared disposable running-state/lock/log fixtures. Assert identified ownership, deadline/progress behavior, synchronous source directory/log identity, unchanged runner inputs and cursor continuation. Use real filesystem behavior; distinguish local controls from actual Windows reproduction.

- [x] Apply minimal canonicalization consistent with realpathSync used by runner initialization and lock publication. Cover selected directory, log, cursor and existing ancestors of missing output paths. Keep recorded identity comparisons strict; do not rewrite snapshots/locks, lowercase identities to authorize them, or canonicalize foreign metadata into acceptance.

- [x] Retain and extend focused rejection coverage for foreign directories, missing token, mismatched run/execution/worktree, invalid or dead PID, foreign cursor/execution and replaced cursor ownership. Preserve signal-0 validation, byte continuity and log identity. Verify reserved current.json, current.json.tmp, events.jsonl, executor.lock and log aliases remain protected, including derived outputs and supported filesystem aliases.

- [x] Update finite diagnostic comparisons so directorySyncAsyncEqual and logSyncAsyncEqual remain honest raw comparisons, while state/lock/source identity comparisons describe the canonical observer representation. Test that raw inequality alone does not imply an anomalous observer outcome. Preserve genuine ownership uncertainty and strict evidence validation.

- [x] Run affected public observer/path/identity/alias and diagnostic regressions with node --test and focused --test-name-pattern selections; record exact commands and results. Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Document comparison semantics and pending Windows acceptance without changing historical evidence.

#### Task 1 verification (local control, 2026-10-12)

- Input revision: `973b0fde82bc5e2cd797ca9ca8669a2641e1bdab`; macOS arm64, Node `v22.21.1`. Runner implementation and historical evidence are unchanged.
- Evidence directory: `work/issue-19/windows-observer-path-repair/task1/`. `commands.json` retains exact commands, input revision, platform, actual exits, log paths and source digests; `diagnosis.json` distinguishes original Windows evidence from local controls.
- Public synchronous fixture/alias regression before repair: exit 0, 1/1; this macOS control does not reproduce the original Windows inequality. After canonicalization: exit 0, 1/1. The original red Windows reproduction remains `work/issue-19/actions-38181153187-observer-inspected.json`, run 38181153187, attempt 1, SHA 0305def0b276f88c148dcb42605eb496a2cc53be.
- Public finite-artifact validation regression: exit 1 before repair (`stateDirectoryMatchesSource` false incorrectly accepted as ordinary), exit 0 after repair, 1/1. Controlled raw-comparison flags are artifact-validation inputs, not a Windows filesystem reproduction.
- Focused observer/diagnostic path, ownership, cursor, alias and privacy selection: exit 0, 29/29, no skips (`focused-path-guards.log`). Final expanded affected selection across observer, unchanged runner and diagnostic tests: exit 0, 44/44, no skips (`final-affected-tests.log`). The selections and all arguments are retained in `commands.json`.
- Public `node scripts/windows-observer-diagnostics.mjs diagnostic --output work/issue-19/windows-observer-path-repair/task1/diagnostic.json`: exit 0; complete/ordinary, both identified deadline cases, unchanged inputs, files removed and owned child exited 0. Both local raw sync/async comparisons are true; actual Windows acceptance remains pending.
- `npm run lint`, `npm run typecheck`, `npm run check:docs` and `git diff --check`: exit 0. Documentation/diff checks are repeated after this plan update. No npm test, build, packaging or product smoke was performed.
- The original 78/79 terminal-state failure, its unchanged assertion and `work/issue-19/observer-terminal-diagnosis/diagnosis.json` remain preserved; its cause remains unproven. Task 1 does not rerun that unchanged terminal-race scenario toward green. Task 2 owns timeout startup diagnosis and the one full three-file test invocation. Exact-SHA Windows jobs/artifacts and separate review remain coordinator-owned gates.

### Task 2: Diagnose preload startup failure and repair the public CLI timeout regression

Files:

- Modify: tests/windows-observer-diagnostics.test.mjs.

- Modify only if diagnosis requires: scripts/windows-observer-diagnostics.mjs.

- Modify: docs/ralphex.md.

- [x] Reproduce the existing timeout fixture through the public CLI before repair. Inspect spawn error, exit status, signal, bounded stderr, status artifact and PID-marker availability before reading owned-child.pid. Distinguish launcher/preload failure, absent test-child startup, readiness delay and timeout-cleanup failure.

- [x] Test the --import hypothesis by changing only the preload argument from its filesystem path to pathToFileURL(preload).href. Retain before/after evidence; a Windows-shaped argument tested elsewhere is a control, not Windows acceptance. If the hypothesis is falsified, diagnose another bounded prediction before changing code.

- [x] Turn the demonstrated failure into a public CLI regression, then apply the smallest supported fix. Use a file URL if supported by evidence; change production supervision only if the reproduction demonstrates a production defect. Do not add retries, extend production deadlines or suppress missing startup evidence.

- [x] Keep the real owned Node test tree and shortened fixture-only deadline. Assert nonzero CLI exit, finite timed_out evidence, nonzero or unavailable child exit, bounded cleanup and that the owned test child/tree is stopped before handoff. Preserve failed startup, cleanup failure, malformed, missing and unreached evidence as failures.

- [x] Run the affected timeout/failed-exit/privacy regressions, then once run node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs. Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Record actual results and diagnosis limits; do not run npm test, builds, packaging or product smoke suites.

#### Task 2 verification (local controls, 2026-10-12)

- Input revision: `c7f18065ab6a9bae3be11ab36ccbc9c4dc1f7bf5`; macOS arm64, Node `v22.21.1` selected by the command-local PATH prefix `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin`. Production observer/runner/diagnostic implementations and historical evidence are unchanged.
- Evidence directory: `work/issue-19/windows-observer-path-repair/task2/`. `commands.json` retains exact commands, actual exits, platform/runtime, input revision, elapsed time, full log paths and per-command source digests. `diagnosis.json` retains predictions, control results, original Windows attribution limits and preserved historical evidence digests. Private probe stdout/stderr remains ignored and is not uploaded.
- Original local fixture before repair: `node --test --test-name-pattern='CI test timeout stops' tests/windows-observer-diagnostics.test.mjs`, exit 0, 1/1 (`original-local-timeout.log`). This macOS control does not reproduce the historical Windows missing-marker failure.
- Preload hypothesis: `node work/issue-19/windows-observer-path-repair/task2/preload-probe.mjs`, exit 0 (`preload-hypothesis.log`, `preload-probe.json`). The public CLI with a raw drive-shaped `C:/...` preload argument exited 1 in 30 ms, without spawn error or signal, with bounded stderr code `ERR_UNSUPPORTED_ESM_URL_SCHEME`, no status artifact and no PID marker. Changing only that argument to a file URL exited 1 after the shortened deadline, with no stderr, a finite `timed_out` artifact, unavailable child exit and a started/stopped owned child. This is a local injected-symptom control, not actual Windows acceptance.
- Public CLI regression: a real preload filename containing spaces and `#` failed before repair with `ERR_MODULE_NOT_FOUND`, no artifact/marker; after replacing only the preload argument with `pathToFileURL(preload).href`, it passed. Both commands were `node --test --test-name-pattern='CI test timeout loads' tests/windows-observer-diagnostics.test.mjs`; actual exits 1 then 0, 0/1 then 1/1 (`preload-fragment-red.log`, `preload-fragment-green.log`). Launcher/error/signal, bounded stderr code/size and startup availability are inspected before conditional PID reads; missing startup remains a failed assertion.
- The final regression retains the real Node test tree and the existing fixture-only 1.5-second deadline, adding one ready owned Node descendant. It requires both distinct valid PID markers, CLI exit 1, a strict finite `timed_out` status, nonzero or unavailable test-process exit, bounded command/cleanup and signal-0 confirmation that both processes stopped before handoff. No retries, longer production deadlines or production supervision changes were added.
- Affected timeout/failed-exit/privacy checks: `node --test --test-name-pattern='timeout|real failed Node test exit|private|strict artifact|unreached|CLI writes|CLI validation' tests/windows-observer-diagnostics.test.mjs`, exit 0, 8/8, no skips (`focused-timeout-failure-privacy.log`).
- One full invocation: `node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs`, exit 0, 89/89, no skips (`full-three-file-tests.log`). The historical terminal-state assertion is unchanged and passed in this invocation; its original 78/79 failure and unproven cause remain preserved. No unchanged retry toward green was performed.
- `npm run lint`, `npm run typecheck`, `npm run check:docs` and `git diff --check`: exit 0. Documentation/diff checks are repeated after this plan update. No npm test, build, packaging or product smoke was performed.
- Historical Windows startup attribution remains unproven: the original test read a missing PID marker before retaining launcher stderr/status. The demonstrated controls support the bounded fixture repair; actual Windows startup/tree cleanup at the next exact SHA, separate review and all other coordinator-owned gates remain pending outside executable Task checkboxes.

## Evidence, Privacy and Failure Semantics

- Reuse work/issue-19/windows-observer-path-repair/ with distinct task1 and task2 evidence subdirectories. Preserve existing diagnosis and artifacts.

- Retain exact command, input revision, platform, Node version, actual exit and red/green result. Identify controlled or injected reproduction separately from original Windows evidence.

- Keep finite diagnostic.json and test-status.json under existing strict schemas and 12 KiB bounds. Preserve raw comparison booleans without publishing path values.

- Keep private child stderr and diagnostic logs in ignored local evidence only; redact secrets before inspection or quotation. Do not upload paths, tokens, identities, PIDs, environment contents, exception text or raw logs.

- Missing, malformed, timed-out, failed and unreached outcomes never establish acceptance. Finite validation of failed evidence does not make its command successful.

- Preserve the original 78/79 red result and unchanged terminal-race assertion. Any recurrence remains a reported failure; do not retry unchanged toward green or repair it from a guessed race. Unexpected failures require evidence and bounded diagnosis before continuation.

## Post-Completion: Coordinator-Owned Gates These are outside executable task checkboxes.

- Inspect completed task changes and checks; commit only completed, verified task files under project rules. A retained red check must remain explicit.

- Perform separate follow-up review from lastReviewedSha 1b33ee88, retaining immutable issueBaseSha 4f9f11f7 and relevant ownership/output-safety context.

- Push the task branch only with corresponding user authorization. No main merge or publication.

- Use the existing independent windows-observer-diagnostic matrix to verify the next exact SHA; no workflow change is required.

- Inspect both Windows jobs and downloaded diagnostic/test-status artifacts by exact SHA, run and attempt. Require identified observer ownership, correct canonical source identity, unchanged inputs, owned cleanup, successful focused tests and truthful raw comparisons. Raw sync/async inequality may remain.

- Confirm the actual Windows timeout regression starts its owned child and stops its tree. Local controls or platform skips cannot satisfy this gate.

- Coordinator owns diagnosis/tracker/snapshot updates and acceptance decisions. Preserve terminal-race attribution as unproven and keep category-fixture diagnostics, product acceptance and whole-issue completion deferred where evidence is missing.
