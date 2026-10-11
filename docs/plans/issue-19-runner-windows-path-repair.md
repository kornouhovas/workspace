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

- [ ] Add public observe regressions using synchronously prepared disposable running-state/lock/log fixtures. Assert identified ownership, deadline/progress behavior, synchronous source directory/log identity, unchanged runner inputs and cursor continuation. Use real filesystem behavior; distinguish local controls from actual Windows reproduction.

- [ ] Apply minimal canonicalization consistent with realpathSync used by runner initialization and lock publication. Cover selected directory, log, cursor and existing ancestors of missing output paths. Keep recorded identity comparisons strict; do not rewrite snapshots/locks, lowercase identities to authorize them, or canonicalize foreign metadata into acceptance.

- [ ] Retain and extend focused rejection coverage for foreign directories, missing token, mismatched run/execution/worktree, invalid or dead PID, foreign cursor/execution and replaced cursor ownership. Preserve signal-0 validation, byte continuity and log identity. Verify reserved current.json, current.json.tmp, events.jsonl, executor.lock and log aliases remain protected, including derived outputs and supported filesystem aliases.

- [ ] Update finite diagnostic comparisons so directorySyncAsyncEqual and logSyncAsyncEqual remain honest raw comparisons, while state/lock/source identity comparisons describe the canonical observer representation. Test that raw inequality alone does not imply an anomalous observer outcome. Preserve genuine ownership uncertainty and strict evidence validation.

- [ ] Run affected public observer/path/identity/alias and diagnostic regressions with node --test and focused --test-name-pattern selections; record exact commands and results. Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Document comparison semantics and pending Windows acceptance without changing historical evidence.

### Task 2: Diagnose preload startup failure and repair the public CLI timeout regression

Files:

- Modify: tests/windows-observer-diagnostics.test.mjs.

- Modify only if diagnosis requires: scripts/windows-observer-diagnostics.mjs.

- Modify: docs/ralphex.md.

- [ ] Reproduce the existing timeout fixture through the public CLI before repair. Inspect spawn error, exit status, signal, bounded stderr, status artifact and PID-marker availability before reading owned-child.pid. Distinguish launcher/preload failure, absent test-child startup, readiness delay and timeout-cleanup failure.

- [ ] Test the --import hypothesis by changing only the preload argument from its filesystem path to pathToFileURL(preload).href. Retain before/after evidence; a Windows-shaped argument tested elsewhere is a control, not Windows acceptance. If the hypothesis is falsified, diagnose another bounded prediction before changing code.

- [ ] Turn the demonstrated failure into a public CLI regression, then apply the smallest supported fix. Use a file URL if supported by evidence; change production supervision only if the reproduction demonstrates a production defect. Do not add retries, extend production deadlines or suppress missing startup evidence.

- [ ] Keep the real owned Node test tree and shortened fixture-only deadline. Assert nonzero CLI exit, finite timed_out evidence, nonzero or unavailable child exit, bounded cleanup and that the owned test child/tree is stopped before handoff. Preserve failed startup, cleanup failure, malformed, missing and unreached evidence as failures.

- [ ] Run the affected timeout/failed-exit/privacy regressions, then once run node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs. Run npm run lint, npm run typecheck, npm run check:docs and git diff --check. Record actual results and diagnosis limits; do not run npm test, builds, packaging or product smoke suites.

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
